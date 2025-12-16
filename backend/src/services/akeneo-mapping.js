const { v4: uuidv4 } = require('uuid');
const ConnectionManager = require('../services/database/ConnectionManager');
const { sanitizeAkeneoProduct } = require('../utils/dataValidation');

class AkeneoMapping {
  constructor() {
    // Default mapping configurations
    this.categoryMapping = {
      // Akeneo field -> DainoStore field
      'code': 'name', // Use code as name if label not available
      'labels': 'name', // Preferred name source
      'parent': 'parent_id'
    };

    this.productMapping = {
      // Basic product fields
      'identifier': 'sku',
      'family': 'attribute_set_id',
      'categories': 'category_ids',
      'enabled': 'status',
      'values': 'attributes'
    };
  }

  /**
   * Transform Akeneo category to DainoStore category format
   */
  transformCategory(akeneoCategory, storeId, locale = 'en_US', settings = {}) {
    const categoryName = this.extractLocalizedValue(akeneoCategory.labels, locale) || akeneoCategory.code;
    
    // Determine what to use for slug generation
    let slugSource = categoryName;
    if (settings.akeneoUrlField) {
      let urlFieldValue = null;
      
      // Try different places where the URL field might be
      if (akeneoCategory.values && akeneoCategory.values[settings.akeneoUrlField]) {
        // For categories with values structure (some Akeneo setups)
        const rawValue = this.extractLocalizedValue(akeneoCategory.values[settings.akeneoUrlField], locale) ||
                        this.extractProductValue(akeneoCategory.values, settings.akeneoUrlField, locale);
        
        // Extract the actual data value if it's an object with data property
        if (rawValue && typeof rawValue === 'object' && rawValue.data) {
          urlFieldValue = rawValue.data;
        } else if (typeof rawValue === 'string') {
          urlFieldValue = rawValue;
        }
      } else if (akeneoCategory[settings.akeneoUrlField]) {
        // For direct field access
        urlFieldValue = akeneoCategory[settings.akeneoUrlField];
        if (typeof urlFieldValue === 'object' && urlFieldValue[locale]) {
          urlFieldValue = urlFieldValue[locale];
        }
      }
      
      if (urlFieldValue && typeof urlFieldValue === 'string' && urlFieldValue.trim()) {
        slugSource = urlFieldValue.trim();
      }
    }
    
    const dainoCategory = {
      store_id: storeId,
      name: categoryName,
      slug: this.generateSlug(slugSource),
      description: null,
      image_url: null,
      sort_order: 0,
      is_active: settings.setNewActive !== undefined ? settings.setNewActive : true,
      hide_in_menu: settings.hideFromMenu || false,
      meta_title: null,
      meta_description: null,
      meta_keywords: null,
      meta_robots_tag: 'index, follow',
      parent_id: null, // Will be resolved later
      level: 0, // Will be calculated
      path: null, // Will be calculated
      product_count: 0,
      // Keep original Akeneo data for reference (temporary fields, not saved to DB)
      _temp_akeneo_code: akeneoCategory.code,
      _temp_parent_akeneo_code: akeneoCategory.parent,
      // Store original slug for comparison
      _originalSlug: this.generateSlug(slugSource)
    };

    return dainoCategory;
  }

  /**
   * Transform Akeneo product to DainoStore product format
   */
  async transformProduct(akeneoProduct, storeId, locale = 'en_US', processedImages = null, customMappings = {}, settings = {}, akeneoClient = null, akeneoAttributeTypes = null) {
    const values = akeneoProduct.values || {};
    
    // Extract product name
    const productName = this.extractProductValue(values, 'name', locale) || 
                       this.extractProductValue(values, 'label', locale) || 
                       akeneoProduct.identifier;
    
    // Determine what to use for slug generation
    let slugSource = productName;
    if (settings.akeneoUrlField && values[settings.akeneoUrlField]) {
      // Try to extract the custom URL field value
      const urlFieldValue = this.extractProductValue(values, settings.akeneoUrlField, locale);
      if (urlFieldValue && typeof urlFieldValue === 'string' && urlFieldValue.trim()) {
        slugSource = urlFieldValue.trim();
      }
    }
    
    // Start with default product structure
    const dainoProduct = {
      store_id: storeId,
      name: productName,
      slug: this.generateSlug(slugSource),
      sku: akeneoProduct.identifier,
      barcode: this.extractProductValue(values, 'ean', locale) || 
               this.extractProductValue(values, 'barcode', locale),
      description: this.extractProductValue(values, 'description', locale),
      short_description: this.extractProductValue(values, 'short_description', locale),
      price: this.extractNumericValue(values, 'price', locale),
      // compare_price - do NOT auto-extract sale_price here, let custom mappings handle it
      compare_price: this.extractNumericValue(values, 'compare_price', locale) ||
                     this.extractNumericValue(values, 'msrp', locale) ||
                     this.extractNumericValue(values, 'regular_price', locale),
      cost_price: this.extractNumericValue(values, 'cost_price', locale) || 
                  this.extractNumericValue(values, 'cost', locale) ||
                  this.extractNumericValue(values, 'wholesale_price', locale),
      weight: this.extractNumericValue(values, 'weight', locale) || 
              this.extractNumericValue(values, 'weight_kg', locale),
      dimensions: this.extractDimensions(values, locale),
      images: await this.extractImages(values, processedImages, settings.downloadImages !== false, settings.akeneoBaseUrl, storeId, akeneoClient, akeneoProduct.identifier, customMappings, akeneoAttributeTypes),
      status: akeneoProduct.enabled ? 'active' : 'inactive',
      visibility: 'visible',
      manage_stock: this.extractBooleanValue(values, 'manage_stock', locale) ?? true,
      stock_quantity: this.extractStockQuantity(values, locale, akeneoProduct),
      allow_backorders: this.extractBooleanValue(values, 'allow_backorders', locale) || false,
      low_stock_threshold: this.extractNumericValue(values, 'low_stock_threshold', locale) || 5,
      infinite_stock: this.extractBooleanValue(values, 'infinite_stock', locale) || false,
      is_custom_option: false,
      is_coupon_eligible: true,
      featured: this.extractBooleanValue(values, 'featured', locale) || false,
      tags: [],
      attributes: await this.extractAllAttributes(values, locale, storeId, akeneoClient, customMappings),
      seo: this.extractSeoData(values, locale),
      attribute_set_id: null, // Will be mapped from family
      category_ids: akeneoProduct.categories || [],
      related_product_ids: [],
      sort_order: 0,
      view_count: 0,
      purchase_count: 0,
      // Keep original Akeneo data for reference
      akeneo_uuid: akeneoProduct.uuid,
      akeneo_identifier: akeneoProduct.identifier,
      akeneo_family: akeneoProduct.family,
      akeneo_groups: akeneoProduct.groups || [],
      // Store original slug for comparison
      _originalSlug: this.generateSlug(slugSource)
    };

    // Apply comprehensive custom attribute mappings
    if (customMappings.attributes && Array.isArray(customMappings.attributes)) {
      const customAttributes = this.applyCustomAttributeMappings(akeneoProduct, customMappings.attributes, locale);
      // Merge custom attributes carefully to avoid adding invalid fields
      Object.keys(customAttributes).forEach(key => {
        if (key === 'attributes') {
          // Merge attributes carefully - preserve formatted attributes (objects with label/value)
          // and only overwrite with raw values if no formatted version exists
          if (customAttributes.attributes) {
            Object.keys(customAttributes.attributes).forEach(attrKey => {
              const existingAttr = dainoProduct.attributes[attrKey];
              const newAttr = customAttributes.attributes[attrKey];
              
              // If existing attribute is already formatted (has label/value), don't overwrite with raw value
              if (existingAttr && typeof existingAttr === 'object' && existingAttr.label && existingAttr.value) {
                console.log(`🔒 Preserving formatted attribute: ${attrKey} = {label: "${existingAttr.label}", value: "${existingAttr.value}"}`);
                // Keep the existing formatted attribute - don't overwrite
              } else {
                // Either no existing attribute or it's not formatted, so use the new value
                dainoProduct.attributes[attrKey] = newAttr;
                console.log(`🔄 Updated attribute: ${attrKey} =`, newAttr);
              }
            });
          }
        } else if (key !== 'metadata' && key !== 'files' && key !== 'custom_attributes') {
          // Check if this is a valid Product model field or should go to attributes
          const productModelFields = [
            'id', 'name', 'slug', 'sku', 'barcode', 'description', 'short_description',
            'price', 'compare_price', 'cost_price', 'weight', 'dimensions', 'images',
            'status', 'visibility', 'manage_stock', 'stock_quantity', 'allow_backorders',
            'low_stock_threshold', 'infinite_stock', 'is_custom_option', 'is_coupon_eligible',
            'featured', 'tags', 'seo', 'store_id', 'attribute_set_id', 'category_ids',
            'related_product_ids', 'sort_order', 'view_count', 'purchase_count'
          ];
          
          if (productModelFields.includes(key)) {
            // This is a direct Product model field - set it directly
            dainoProduct[key] = customAttributes[key];
            console.log(`🎯 Mapped to Product field: ${key} = ${customAttributes[key]}`);
          } else {
            // This should be a DainoStore attribute - put it in the attributes object
            if (!dainoProduct.attributes[key]) {
              dainoProduct.attributes[key] = customAttributes[key];
              console.log(`🎯 Mapped to DainoStore attribute: ${key} = ${customAttributes[key]}`);
            }
          }
        }
      });
    }

    // Extract common e-commerce attributes with enhanced fallbacks
    const commonAttributes = this.extractCommonAttributes(values, locale);

    // Only these fields are valid columns on the products table
    const validProductFields = ['price', 'compare_price', 'cost_price'];

    // Only set valid product fields - attribute values (brand, color, size, etc.)
    // should be handled via attributes table and product_attribute_values
    Object.keys(commonAttributes).forEach(key => {
      if (commonAttributes[key] !== null && commonAttributes[key] !== undefined) {
        if (validProductFields.includes(key)) {
          if (dainoProduct[key] === null || dainoProduct[key] === undefined) {
            dainoProduct[key] = commonAttributes[key];
          }
        }
        // Note: brand, material, color, size, warranty, care_instructions are NOT stored here
        // They should be imported via attributes and linked via product_attribute_values
      }
    });


    // Apply custom image mappings
    if (customMappings.images && Array.isArray(customMappings.images)) {
      const customImages = [];
      customMappings.images.forEach(mapping => {
        if (mapping.enabled && mapping.akeneoField) {
          const imageData = values[mapping.akeneoField];
          if (imageData && Array.isArray(imageData)) {
            imageData.forEach(item => {
              if (item.data) {
                const imageUrl = typeof item.data === 'string' ? item.data : 
                               (item.data.url || item.data.path || item.data.href);
                
                if (imageUrl) {
                  customImages.push({
                    url: imageUrl,
                    alt: '',
                    sort_order: customImages.length,
                    variants: {
                      thumbnail: imageUrl,
                      medium: imageUrl,
                      large: imageUrl
                    },
                    metadata: {
                      attribute: mapping.akeneoField,
                      scope: item.scope,
                      locale: item.locale,
                      customMapping: true,
                      dainoField: mapping.dainoField
                    }
                  });
                }
              }
            });
          }
        }
      });
      
      // Replace or merge with existing images based on mapping configuration
      if (customImages.length > 0) {
        dainoProduct.images = [...dainoProduct.images, ...customImages];
      }
    }

    // Apply custom file mappings
    if (customMappings.files && Array.isArray(customMappings.files)) {
      const customFiles = [];
      customMappings.files.forEach(mapping => {
        if (mapping.enabled && mapping.akeneoField) {
          const fileData = values[mapping.akeneoField];
          if (fileData && Array.isArray(fileData)) {
            fileData.forEach(item => {
              if (item.data) {
                const fileUrl = typeof item.data === 'string' ? item.data : 
                               (item.data.url || item.data.path || item.data.href);
                
                if (fileUrl) {
                  customFiles.push({
                    url: fileUrl,
                    name: item.data.name || mapping.akeneoField,
                    type: item.data.extension || 'unknown',
                    size: item.data.size || null,
                    metadata: {
                      attribute: mapping.akeneoField,
                      scope: item.scope,
                      locale: item.locale,
                      customMapping: true,
                      dainoField: mapping.dainoField
                    }
                  });
                }
              }
            });
          }
        }
      });
      
      // Add custom files to product
      if (customFiles.length > 0) {
        dainoProduct.files = customFiles;
      }
    }

    // Apply final data validation to prevent [object Object] errors
    const sanitizedProduct = sanitizeAkeneoProduct(dainoProduct);
    return sanitizedProduct;
  }

  /**
   * Transform Akeneo product model to DainoStore configurable product format
   */
  async transformProductModel(akeneoProductModel, storeId, locale = 'en_US', processedImages = null, customMappings = {}, settings = {}, akeneoClient = null, akeneoAttributeTypes = null) {
    const values = akeneoProductModel.values || {};

    // Extract product name
    const productName = this.extractProductValue(values, 'name', locale) ||
                       this.extractProductValue(values, 'label', locale) ||
                       akeneoProductModel.code;

    // Determine what to use for slug generation
    let slugSource = productName;
    if (settings.akeneoUrlField && values[settings.akeneoUrlField]) {
      const urlFieldValue = this.extractProductValue(values, settings.akeneoUrlField, locale);
      if (urlFieldValue && typeof urlFieldValue === 'string' && urlFieldValue.trim()) {
        slugSource = urlFieldValue.trim();
      }
    }

    // Extract variation axes (configurable attributes)
    const variationAxes = akeneoProductModel.family_variant?.variant_attribute_sets?.[0]?.axes || [];

    // Start with configurable product structure
    const configurableProduct = {
      store_id: storeId,
      name: productName,
      slug: this.generateSlug(slugSource),
      sku: `${akeneoProductModel.code}-configurable`, // Configurable products need unique SKU
      type: 'configurable', // Set type as configurable
      barcode: this.extractProductValue(values, 'ean', locale) ||
               this.extractProductValue(values, 'barcode', locale),
      description: this.extractProductValue(values, 'description', locale),
      short_description: this.extractProductValue(values, 'short_description', locale),
      price: this.extractNumericValue(values, 'price', locale),
      compare_price: this.extractNumericValue(values, 'compare_price', locale) ||
                     this.extractNumericValue(values, 'msrp', locale),
      cost_price: this.extractNumericValue(values, 'cost_price', locale) ||
                  this.extractNumericValue(values, 'cost', locale),
      weight: this.extractNumericValue(values, 'weight', locale),
      dimensions: this.extractDimensions(values, locale),
      images: await this.extractImages(values, processedImages, settings.downloadImages !== false, settings.akeneoBaseUrl, storeId, akeneoClient, akeneoProductModel.code, customMappings, akeneoAttributeTypes),
      status: 'active', // Product models are typically active
      visibility: 'visible',
      manage_stock: false, // Configurable products don't manage stock directly
      stock_quantity: 0,
      allow_backorders: false,
      low_stock_threshold: 0,
      infinite_stock: false,
      is_custom_option: false,
      is_coupon_eligible: true,
      featured: this.extractBooleanValue(values, 'featured', locale) || false,
      tags: [],
      attributes: await this.extractAllAttributes(values, locale, storeId, akeneoClient, customMappings),
      seo: this.extractSeoData(values, locale),
      attribute_set_id: null, // Will be mapped from family
      category_ids: akeneoProductModel.categories || [],
      related_product_ids: [],
      configurable_attributes: variationAxes, // Store the axes codes for configuration
      sort_order: 0,
      view_count: 0,
      purchase_count: 0,
      // Keep original Akeneo data for reference
      akeneo_code: akeneoProductModel.code,
      akeneo_family: akeneoProductModel.family,
      akeneo_family_variant: akeneoProductModel.family_variant?.code,
      _originalSlug: this.generateSlug(slugSource)
    };

    return configurableProduct;
  }

  /**
   * Apply custom field mapping to daino product
   */
  applyCustomMapping(dainoProduct, dainoField, akeneoValue, akeneoField) {
    // Handle different types of daino fields
    switch (dainoField) {
      case 'product_name':
      case 'name':
        dainoProduct.name = akeneoValue;
        dainoProduct.slug = this.generateSlug(akeneoValue);
        break;
      
      case 'description':
        dainoProduct.description = akeneoValue;
        break;
      
      case 'short_description':
        dainoProduct.short_description = akeneoValue;
        break;
      
      case 'price':
        // Handle complex price objects from Akeneo (e.g., [{ amount: "29.99", currency: "USD" }])
        const numericPrice = this.extractPriceFromValue(akeneoValue);
        if (numericPrice !== null) {
          dainoProduct.price = numericPrice;
        }
        break;
      
      case 'compare_price':
      case 'msrp':
        // Handle complex price objects from Akeneo (e.g., [{ amount: "29.99", currency: "USD" }])
        const numericComparePrice = this.extractPriceFromValue(akeneoValue);
        if (numericComparePrice !== null) {
          dainoProduct.compare_price = numericComparePrice;
        }
        break;
      
      case 'cost_price':
        // Handle complex price objects from Akeneo (e.g., [{ amount: "29.99", currency: "USD" }])
        const numericCostPrice = this.extractPriceFromValue(akeneoValue);
        if (numericCostPrice !== null) {
          dainoProduct.cost_price = numericCostPrice;
        }
        break;
      
      case 'weight':
        // Handle complex weight objects from Akeneo (similar to price objects)
        const numericWeight = this.extractPriceFromValue(akeneoValue);
        if (numericWeight !== null) {
          dainoProduct.weight = numericWeight;
        }
        break;
      
      case 'sku':
        dainoProduct.sku = akeneoValue;
        break;
      
      case 'barcode':
      case 'ean':
        dainoProduct.barcode = akeneoValue;
        break;
      
      case 'meta_title':
        if (!dainoProduct.seo) dainoProduct.seo = {};
        dainoProduct.seo.meta_title = akeneoValue;
        break;
      
      case 'meta_description':
        if (!dainoProduct.seo) dainoProduct.seo = {};
        dainoProduct.seo.meta_description = akeneoValue;
        break;
      
      case 'meta_keywords':
        if (!dainoProduct.seo) dainoProduct.seo = {};
        dainoProduct.seo.meta_keywords = akeneoValue;
        break;
      
      case 'featured':
        dainoProduct.featured = Boolean(akeneoValue);
        break;
      
      case 'status':
        // Map various status values
        if (typeof akeneoValue === 'boolean') {
          dainoProduct.status = akeneoValue ? 'active' : 'inactive';
        } else if (typeof akeneoValue === 'string') {
          const statusValue = akeneoValue.toLowerCase();
          if (['active', 'enabled', 'true', '1', 'yes'].includes(statusValue)) {
            dainoProduct.status = 'active';
          } else if (['inactive', 'disabled', 'false', '0', 'no'].includes(statusValue)) {
            dainoProduct.status = 'inactive';
          }
        }
        break;
      
      case 'stock_quantity':
        // Handle complex stock quantity objects from Akeneo
        const numericStock = this.extractPriceFromValue(akeneoValue);
        if (numericStock !== null) {
          dainoProduct.stock_quantity = Math.max(0, Math.floor(numericStock));
        }
        break;
      
      case 'manage_stock':
        dainoProduct.manage_stock = Boolean(akeneoValue);
        break;
      
      case 'infinite_stock':
        dainoProduct.infinite_stock = Boolean(akeneoValue);
        break;
      
      case 'low_stock_threshold':
        // Handle complex threshold objects from Akeneo (similar to price objects)
        const numericThreshold = this.extractPriceFromValue(akeneoValue);
        if (numericThreshold !== null && !isNaN(numericThreshold)) {
          dainoProduct.low_stock_threshold = Math.max(0, Math.floor(numericThreshold));
        }
        break;
      
      case 'special_price':
        // Handle complex special price objects from Akeneo
        const numericSpecialPrice = this.extractPriceFromValue(akeneoValue);
        if (numericSpecialPrice !== null && !isNaN(numericSpecialPrice)) {
          dainoProduct.special_price = numericSpecialPrice;
        }
        break;
      
      
      default:
        // For any other custom fields, add to attributes object
        if (!dainoProduct.custom_attributes) {
          dainoProduct.custom_attributes = {};
        }
        dainoProduct.custom_attributes[dainoField] = akeneoValue;
        break;
    }
  }

  /**
   * Extract localized value from Akeneo labels/values
   */
  extractLocalizedValue(labels, locale = 'en_US', fallbackLocale = 'en_US') {
    if (!labels) return null;
    
    // Try exact locale match
    if (labels[locale]) return labels[locale];
    
    // Try fallback locale
    if (labels[fallbackLocale]) return labels[fallbackLocale];
    
    // Try first available locale
    const firstKey = Object.keys(labels)[0];
    return firstKey ? labels[firstKey] : null;
  }

  /**
   * Extract product attribute value considering scope and locale
   */
  extractProductValue(values, attributeCode, locale = 'en_US', scope = null) {
    const attribute = values[attributeCode];
    if (!attribute || !Array.isArray(attribute)) return null;

    // Find value that matches locale and scope criteria
    const matchingValue = attribute.find(item => {
      const localeMatch = !item.locale || item.locale === locale;
      const scopeMatch = !scope || !item.scope || item.scope === scope;
      return localeMatch && scopeMatch;
    });

    return matchingValue ? matchingValue.data : null;
  }

  /**
   * Extract all product attribute values for multiselect attributes
   * Returns array of all matching values considering scope and locale
   */
  extractProductValues(values, attributeCode, locale = 'en_US', scope = null) {
    const attribute = values[attributeCode];
    if (!attribute || !Array.isArray(attribute)) return null;

    // Find all values that match locale and scope criteria
    const matchingValues = attribute.filter(item => {
      const localeMatch = !item.locale || item.locale === locale;
      const scopeMatch = !scope || !item.scope || item.scope === scope;
      return localeMatch && scopeMatch;
    });

    if (matchingValues.length === 0) return null;

    // Return array of data values
    return matchingValues.map(item => item.data).filter(data => data !== null && data !== undefined);
  }

  /**
   * Extract stock quantity from Akeneo product data
   * Handles various Akeneo inventory structures and fallbacks
   */
  extractStockQuantity(values, locale = 'en_US', akeneoProduct = {}) {
    // Try common Akeneo inventory attribute names
    const stockAttributes = [
      'quantity_and_stock_status', 'stock_quantity', 'quantity', 'inventory', 'stock', 
      'available_quantity', 'qty', 'in_stock_quantity',
      'warehouse_quantity', 'on_hand_quantity'
    ];
    
    // First, try to extract from product values (attribute-based inventory)
    for (const attrName of stockAttributes) {
      const stockValue = this.extractNumericValue(values, attrName, locale);
      if (stockValue !== null && stockValue >= 0) {
        console.log(`📦 Found stock from attribute '${attrName}': ${stockValue}`);
        return Math.floor(stockValue); // Ensure integer
      }
    }
    
    // Check if there's quantified associations (Akeneo Enterprise feature)
    if (akeneoProduct.quantified_associations) {
      let totalQuantity = 0;
      Object.values(akeneoProduct.quantified_associations).forEach(association => {
        if (association.products) {
          association.products.forEach(product => {
            if (product.quantity && typeof product.quantity === 'number') {
              totalQuantity += product.quantity;
            }
          });
        }
      });
      
      if (totalQuantity > 0) {
        console.log(`📦 Found stock from quantified associations: ${totalQuantity}`);
        return Math.floor(totalQuantity);
      }
    }
    
    // Check product completeness data (might contain inventory flags)
    if (akeneoProduct.completeness) {
      // Some Akeneo setups use completeness to track availability
      const hasCompleteInventory = Object.values(akeneoProduct.completeness).some(
        channel => channel.data && channel.data.inventory_complete === true
      );
      
      if (hasCompleteInventory) {
        // Default to 1 if inventory is marked as complete but no quantity found
        console.log(`📦 Product marked as inventory complete, defaulting to stock: 1`);
        return 1;
      }
    }
    
    // Check if product is enabled - if disabled, assume out of stock
    if (!akeneoProduct.enabled) {
      console.log(`📦 Product disabled in Akeneo, setting stock to: 0`);
      return 0;
    }
    
    // Final fallback: check boolean stock status attributes
    const inStockAttributes = ['in_stock', 'is_in_stock', 'available'];
    for (const attr of inStockAttributes) {
      const stockStatus = this.extractBooleanValue(values, attr, locale);
      if (stockStatus === true) {
        console.log(`📦 Product marked as in stock (${attr}), defaulting to stock: 10`);
        return 10; // Default available quantity
      } else if (stockStatus === false) {
        console.log(`📦 Product marked as out of stock (${attr}): 0`);
        return 0;
      }
      // stockStatus === null means attribute doesn't exist, continue checking
    }
    
    // Ultimate fallback for enabled products with no inventory data
    console.log(`📦 No inventory data found, using default stock for enabled product: 5`);
    return 5; // Conservative default for enabled products
  }

  /**
   * Extract numeric value from product attributes
   */
  extractNumericValue(values, attributeCode, locale = 'en_US') {
    const value = this.extractProductValue(values, attributeCode, locale);
    if (value === null || value === undefined) return null;
    
    // Handle Akeneo price collection format: [{ amount: "29.99", currency: "USD" }]
    if (Array.isArray(value) && value.length > 0) {
      // For price collections, get the first price's amount
      const firstPrice = value[0];
      if (firstPrice && typeof firstPrice === 'object' && firstPrice.amount !== undefined) {
        const numericValue = parseFloat(firstPrice.amount);
        return isNaN(numericValue) ? null : numericValue;
      }
    }
    
    // Handle single Akeneo price object: { amount: "29.99", currency: "USD" }
    if (typeof value === 'object' && value !== null && !Array.isArray(value) && value.amount !== undefined) {
      const numericValue = parseFloat(value.amount);
      return isNaN(numericValue) ? null : numericValue;
    }
    
    // Handle simple numeric values (string or number)
    if (typeof value === 'string' || typeof value === 'number') {
      const numericValue = parseFloat(value);
      return isNaN(numericValue) ? null : numericValue;
    }
    
    return null;
  }

  /**
   * Extract price from complex Akeneo value (handles both simple values and price objects)
   */
  extractPriceFromValue(value) {
    if (value === null || value === undefined) return null;
    
    // Handle Akeneo price collection format: [{ amount: "29.99", currency: "USD" }]
    if (Array.isArray(value) && value.length > 0) {
      // For price collections, get the first price's amount
      const firstPrice = value[0];
      if (firstPrice && typeof firstPrice === 'object' && firstPrice.amount !== undefined) {
        const numericValue = parseFloat(firstPrice.amount);
        return isNaN(numericValue) ? null : numericValue;
      }
    }
    
    // Handle single Akeneo price object: { amount: "29.99", currency: "USD" }
    if (typeof value === 'object' && value !== null && !Array.isArray(value) && value.amount !== undefined) {
      const numericValue = parseFloat(value.amount);
      return isNaN(numericValue) ? null : numericValue;
    }
    
    // Handle simple numeric values (string or number)
    if (typeof value === 'string' || typeof value === 'number') {
      const numericValue = parseFloat(value);
      return isNaN(numericValue) ? null : numericValue;
    }
    
    return null;
  }

  /**
   * Extract boolean value from product attributes
   */
  extractBooleanValue(values, attributeCode, locale = 'en_US') {
    const value = this.extractProductValue(values, attributeCode, locale);
    if (value === null || value === undefined) return null; // Return null for missing attributes
    
    return Boolean(value);
  }

  /**
   * Extract dimensions object from product attributes
   */
  extractDimensions(values, locale = 'en_US') {
    const length = this.extractNumericValue(values, 'length', locale);
    const width = this.extractNumericValue(values, 'width', locale);
    const height = this.extractNumericValue(values, 'height', locale);

    if (!length && !width && !height) return null;

    return {
      length: length || 0,
      width: width || 0,
      height: height || 0,
      unit: 'cm' // Default unit, could be configurable
    };
  }

  /**
   * Extract images from product attributes (enhanced)
   * Automatically extracts all Akeneo pim_catalog_image type attributes
   */
  async extractImages(values, processedImages = null, downloadImages = true, baseUrl = null, storeId = null, akeneoClient = null, productIdentifier = null, customMappings = null, akeneoAttributeTypes = null) {
    // If we have processed images from Cloudflare, use those
    if (processedImages && processedImages.length > 0) {
      return processedImages.map((img, index) => ({
        url: img.primary_url || img.url,
        alt: img.alt || '',
        sort_order: img.sort_order || index,
        variants: img.variants || {
          thumbnail: img.thumbnail || img.url,
          medium: img.medium || img.url,
          large: img.large || img.url
        },
        metadata: img.metadata || {}
      }));
    }
    
    // Fallback to original extraction logic
    const images = [];
    let foundImageCount = 0;
    
    // Use custom image mappings if provided, otherwise use defaults
    let imageAttributes = [];
    
    if (customMappings?.images && Array.isArray(customMappings.images)) {
      // Get enabled image mappings sorted by priority
      const enabledMappings = customMappings.images
        .filter(m => m.enabled && m.akeneoField)
        .sort((a, b) => (a.priority || 999) - (b.priority || 999));
      
      // Extract the Akeneo field names
      imageAttributes = enabledMappings.map(m => m.akeneoField);
      
      console.log(`📸 Using ${imageAttributes.length} custom image mappings from configuration`);
      console.log(`  Mapped fields in priority order: ${imageAttributes.join(', ')}`);
    }
    
    // If no custom mappings or they're empty, use comprehensive defaults
    if (imageAttributes.length === 0) {
      imageAttributes = [
        'image', 'images', 'picture', 'pictures', 'photo', 'photos',
        'main_image', 'product_image', 'product_images', 'gallery',
        'gallery_image', 'gallery_images', 'base_image', 'small_image',
        'thumbnail', 'thumbnail_image', 'media_gallery', 'media_image',
        // Akeneo-specific attribute patterns
        'pim_catalog_image', 'catalog_image', 'asset_image', 'variation_image',
        // Additional Akeneo asset/media patterns
        'assets', 'media', 'media_files', 'product_media',
        // Numbered image patterns
        'image_0', 'image_1', 'image_2', 'image_3', 'image_4',
        'image_5', 'image_6', 'image_7', 'image_8', 'image_9'
      ];
      console.log(`📸 No custom mappings provided, using default image attribute list`);
    }

    // AUTOMATIC: Add all attributes that have type pim_catalog_image or pim_catalog_file
    if (akeneoAttributeTypes && typeof akeneoAttributeTypes === 'object') {
      const autoImageAttrs = [];
      const autoFileAttrs = [];

      for (const [attrCode, attrType] of Object.entries(akeneoAttributeTypes)) {
        if (attrType === 'pim_catalog_image') {
          if (!imageAttributes.includes(attrCode)) {
            imageAttributes.push(attrCode);
            autoImageAttrs.push(attrCode);
          }
        } else if (attrType === 'pim_catalog_file') {
          // Also treat file type attributes as potential images/files
          if (!imageAttributes.includes(attrCode)) {
            imageAttributes.push(attrCode);
            autoFileAttrs.push(attrCode);
          }
        }
      }

      if (autoImageAttrs.length > 0) {
        console.log(`📷 AUTO-MAPPED ${autoImageAttrs.length} pim_catalog_image attributes: ${autoImageAttrs.join(', ')}`);
      }
      if (autoFileAttrs.length > 0) {
        console.log(`📄 AUTO-MAPPED ${autoFileAttrs.length} pim_catalog_file attributes: ${autoFileAttrs.join(', ')}`);
      }
    }
    
    console.log(`\n🖼️ ===== EXTRACTING IMAGES FROM AKENEO PRODUCT =====`);
    console.log(`📊 Settings:`);
    console.log(`  - Download images: ${downloadImages}`);
    console.log(`  - AkeneoClient available: ${!!akeneoClient}`);
    console.log(`  - Store ID: ${storeId}`);
    console.log(`  - Base URL: ${baseUrl}`);
    console.log(`\n🔍 Product values structure:`);
    console.log(`  - Total attributes: ${Object.keys(values).length}`);
    console.log(`  - Attribute names: ${Object.keys(values).join(', ')}`);
    
    // Debug: Check if ANY attributes contain potential image data
    console.log(`\n🔎 Scanning ALL attributes for potential image data...`);
    let potentialImageAttrs = [];
    for (const [key, value] of Object.entries(values)) {
      if (value && Array.isArray(value) && value.length > 0) {
        const firstItem = value[0];
        if (firstItem && firstItem.data) {
          const dataType = typeof firstItem.data;
          const dataPreview = dataType === 'string' 
            ? firstItem.data.substring(0, 100) 
            : JSON.stringify(firstItem.data).substring(0, 100);
          
          // Check if this could be an image attribute
          if (dataType === 'string') {
            const data = firstItem.data;
            const looksLikeImage = data.includes('.jpg') || data.includes('.png') || 
                                  data.includes('.jpeg') || data.includes('.gif') || 
                                  data.includes('.webp') || data.includes('image') ||
                                  data.includes('media') || data.includes('asset') ||
                                  (!data.includes('/') && !data.startsWith('http') && data.length < 50);
            
            if (looksLikeImage) {
              potentialImageAttrs.push(key);
              console.log(`  📌 "${key}": ${value.length} item(s), data type: ${dataType}`);
              console.log(`     Preview: ${dataPreview}${dataPreview.length >= 100 ? '...' : ''}`);
              if (!imageAttributes.includes(key)) {
                console.log(`     ⚠️ POTENTIAL IMAGE ATTRIBUTE NOT IN LIST!`);
              }
            }
          }
        }
      }
    }
    
    if (potentialImageAttrs.length === 0) {
      console.log(`  ❌ No potential image attributes found in product data!`);
    } else {
      console.log(`  ✅ Found ${potentialImageAttrs.length} potential image attributes: ${potentialImageAttrs.join(', ')}`);
    }
    
    console.log(`\n🔍 Checking known image attributes...`);
    for (const key of Object.keys(values)) {
      if (imageAttributes.includes(key)) {
        console.log(`📊 Found known image attribute '${key}':`, JSON.stringify(values[key], null, 2));
      }
    }
    
    console.log(`\n🔄 Processing image attributes...`);
    for (const attrName of imageAttributes) {
      const imageData = values[attrName];
      if (imageData && Array.isArray(imageData)) {
        console.log(`\n📸 Found attribute '${attrName}' with ${imageData.length} item(s)`);
        console.log(`  Full data:`, JSON.stringify(imageData, null, 2));
        
        for (let i = 0; i < imageData.length; i++) {
          const item = imageData[i];
          console.log(`\n  🔍 Processing item ${i + 1}/${imageData.length}:`, JSON.stringify(item, null, 2));
          if (item && item.data) {
            let imageUrl = null;
            let isMediaCode = false;
            let isAssetCode = false;
            
            // Handle different Akeneo image data structures
            if (typeof item.data === 'string') {
              // Check if it's a media file code or path
              // Media file paths look like: e/b/2/c/eb2c09153411547fcdf9918e23c4593313ab8f16_04w0485_8525.webp
              // These are NOT URLs but media file codes that need API access
              const isAkeneoMediaPath = item.data.match(/^[a-f0-9]\/[a-f0-9]\/[a-f0-9]\/[a-f0-9]\/.+$/i);
              const isHttpUrl = item.data.startsWith('http://') || item.data.startsWith('https://');
              const isSingleCode = !item.data.includes('/') && !item.data.includes('.');
              
              if ((isAkeneoMediaPath || isSingleCode) && !isHttpUrl) {
                // This is a media file code/path that needs API access
                console.log(`🔑 Detected media file code/path: ${item.data}`);
                
                // Try to fetch media file or asset details
                if (akeneoClient) {
                  try {
                    // First try as media file
                    console.log(`📂 Attempting to fetch media file: ${item.data}`);
                    const mediaFile = await akeneoClient.getMediaFile(item.data);
                    if (mediaFile && mediaFile._links?.download?.href) {
                      imageUrl = mediaFile._links.download.href;
                      isMediaCode = true;
                      console.log(`✅ Found media file download URL: ${imageUrl}`);
                    }
                  } catch (mediaError) {
                    console.log(`❌ Not a media file: ${mediaError.message}`);
                    
                    // Try as asset (only for single codes, not paths)
                    if (isSingleCode) {
                      try {
                        console.log(`📦 Attempting to fetch asset: ${item.data}`);
                        const asset = await akeneoClient.getAsset(item.data);
                        if (asset && asset.reference_files && asset.reference_files.length > 0) {
                          // Get the first reference file
                          const refFile = asset.reference_files[0];
                          if (refFile._links?.download?.href) {
                            imageUrl = refFile._links.download.href;
                            isAssetCode = true;
                            console.log(`✅ Found asset download URL: ${imageUrl}`);
                          }
                        }
                      } catch (assetError) {
                        console.log(`❌ Not an asset either: ${assetError.message}`);
                        // For media paths, we can't use them as direct URLs
                        if (isAkeneoMediaPath) {
                          console.log(`⚠️ Media file path cannot be used as direct URL, skipping`);
                          imageUrl = null;
                        } else {
                          imageUrl = item.data;
                        }
                      }
                    } else if (isAkeneoMediaPath) {
                      // For media paths that failed API lookup, we can't use them as URLs
                      console.log(`⚠️ Media file path cannot be used as direct URL, skipping`);
                      imageUrl = null;
                    } else {
                      imageUrl = item.data;
                    }
                  }
                } else {
                  // No client available
                  if (isAkeneoMediaPath) {
                    console.log(`⚠️ No Akeneo client available to fetch media file, skipping`);
                    imageUrl = null;
                  } else {
                    imageUrl = item.data;
                  }
                }
              } else {
                // It's already a URL or a regular path
                imageUrl = item.data;
              }
            } else if (typeof item.data === 'object') {
              // Handle asset or reference structure
              imageUrl = item.data.url || item.data.path || item.data.href || 
                        item.data.download_link || item.data.reference_files?.[0]?.download_link;
              
              // Handle Akeneo asset structure
              if (item.data._links?.download?.href) {
                imageUrl = item.data._links.download.href;
              }
            }
            
            if (imageUrl && typeof imageUrl === 'string' && imageUrl.trim()) {
              imageUrl = imageUrl.trim();
              console.log(`📷 Processing image URL: ${imageUrl}`);
              
              // Make sure URL is absolute (but only if it's not already a full URL)
              if (!imageUrl.startsWith('http') && baseUrl) {
                // Check if it's an API path that needs the base URL
                if (imageUrl.startsWith('/api/')) {
                  const cleanBaseUrl = baseUrl.replace(/\/+$/, '');
                  imageUrl = `${cleanBaseUrl}${imageUrl}`;
                  console.log(`🔗 Constructed API URL: ${imageUrl}`);
                } else if (!isMediaCode && !isAssetCode) {
                  // Only construct URLs for non-media/asset paths
                  const cleanBaseUrl = baseUrl.replace(/\/+$/, '');
                  const cleanImageUrl = imageUrl.replace(/^\/+/, '');
                  imageUrl = `${cleanBaseUrl}/${cleanImageUrl}`;
                  console.log(`🔗 Constructed absolute URL: ${imageUrl}`);
                }
              }
              
              let finalImageUrl = imageUrl;
              let uploadResult = null;
              
              // Download and upload image if enabled
              if (downloadImages && imageUrl.startsWith('http')) {
                try {
                  console.log(`⬇️ Attempting to download image: ${imageUrl}`);
                  // Use authenticated download for media files and assets
                  const needsAuth = isMediaCode || isAssetCode || imageUrl.includes('/api/rest/');
                  uploadResult = await this.downloadAndUploadImage(imageUrl, item, storeId, needsAuth ? akeneoClient : null, productIdentifier);
                  if (uploadResult && uploadResult.url) {
                    finalImageUrl = uploadResult.url;
                    console.log(`✅ Image uploaded successfully to Supabase!`);
                    console.log(`   Original Akeneo URL: ${imageUrl}`);
                    console.log(`   New Supabase URL: ${finalImageUrl}`);
                    console.log(`   Upload provider: ${uploadResult.uploadedTo || 'unknown'}`);
                  } else {
                    console.warn(`⚠️ Upload result missing URL, keeping original: ${imageUrl}`);
                  }
                } catch (error) {
                  console.warn(`⚠️ Failed to download/upload image ${imageUrl}:`, error.message);
                  console.warn(`📋 Error details:`, error.stack);
                  // Continue with original URL as fallback
                }
              }
              
              // Extract alt text from various sources
              const altText = (item.data && typeof item.data === 'object' ? item.data.alt : '') ||
                            (item.alt) ||
                            (item.data?.title) ||
                            (item.data?.name) ||
                            '';
              
              const imageObject = {
                url: finalImageUrl,
                alt: altText,
                sort_order: images.length,
                variants: {
                  thumbnail: finalImageUrl,
                  medium: finalImageUrl, 
                  large: finalImageUrl
                },
                metadata: {
                  attribute: attrName,
                  scope: item.scope,
                  locale: item.locale,
                  original_url: imageUrl,
                  downloaded: !!uploadResult,
                  is_media_code: isMediaCode,
                  is_asset_code: isAssetCode,
                  upload_result: uploadResult ? {
                    provider: uploadResult.uploadedTo,
                    filename: uploadResult.filename,
                    size: uploadResult.size,
                    fallback_used: uploadResult.fallbackUsed
                  } : null
                }
              };
              
              images.push(imageObject);
              foundImageCount++;
              console.log(`📁 Added image ${foundImageCount}:`);
              console.log(`   Final URL being saved: ${finalImageUrl}`);
              console.log(`   Is Supabase URL: ${finalImageUrl.includes('supabase.co')}`);
              console.log(`   Is Akeneo URL: ${finalImageUrl.includes('akeneo')}`);
              console.log(`   Was downloaded/uploaded: ${!!uploadResult}`);
            }
          }
        }
      }
    }

    console.log(`\n🎯 ===== IMAGE EXTRACTION COMPLETE =====`);
    console.log(`  Total images found: ${images.length}`);
    console.log(`  Found image count tracker: ${foundImageCount}`);
    if (images.length > 0) {
      console.log(`  Images extracted:`);
      images.forEach((img, idx) => {
        console.log(`    ${idx + 1}. URL: ${img.url}`);
        console.log(`       Original: ${img.metadata?.original_url || 'N/A'}`);
        console.log(`       Downloaded: ${img.metadata?.downloaded || false}`);
        console.log(`       From attribute: ${img.metadata?.attribute || 'unknown'}`);
      });
    } else {
      console.log(`  ❌ NO IMAGES EXTRACTED!`);
    }
    console.log(`========================================\n`);
    
    return images;
  }

  /**
   * Download image from Akeneo and upload to storage system
   */
  async downloadAndUploadImage(imageUrl, imageItem, storeId = null, akeneoClient = null, productIdentifier = null) {
    const storageManager = require('./storage-manager');
    const StoragePathUtility = require('./storage-path-utility');
    
    try {
      console.log(`📥 Downloading image from Akeneo: ${imageUrl}`);
      
      let buffer;
      let contentType = 'image/jpeg';
      
      // Check if we need authenticated download
      if (akeneoClient && (imageUrl.includes('/api/rest/') || imageUrl.includes('/media/'))) {
        console.log(`🔐 Using authenticated download for: ${imageUrl}`);
        try {
          // Use the authenticated download method
          buffer = await akeneoClient.downloadAuthenticatedFile(imageUrl);
          console.log(`✅ Authenticated download successful: ${buffer.length} bytes`);
          
          // Try to determine content type from URL or default to jpeg
          if (imageUrl.includes('.png')) contentType = 'image/png';
          else if (imageUrl.includes('.gif')) contentType = 'image/gif';
          else if (imageUrl.includes('.webp')) contentType = 'image/webp';
          else if (imageUrl.includes('.svg')) contentType = 'image/svg+xml';
        } catch (authError) {
          console.warn(`⚠️ Authenticated download failed, trying regular download: ${authError.message}`);
          // Fall back to regular download
          const fetch = (await import('node-fetch')).default;
          const response = await fetch(imageUrl);
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }
          buffer = await response.buffer();
          contentType = response.headers.get('content-type') || 'image/jpeg';
        }
      } else {
        // Regular download without authentication
        console.log(`📥 Using regular download for: ${imageUrl}`);
        const fetch = (await import('node-fetch')).default;
        const response = await fetch(imageUrl);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        buffer = await response.buffer();
        contentType = response.headers.get('content-type') || 'image/jpeg';
      }
      
      // Get the file extension from content type
      const extension = contentType.split('/')[1]?.replace('+xml', '') || 'jpg';
      
      console.log(`💾 Downloaded image: ${buffer.length} bytes, type: ${contentType}`);
      
      // Extract original filename - try multiple sources
      let originalFileName = null;
      
      // 1. First try to get filename from imageItem.data (if it looks like a file path)
      if (imageItem && imageItem.data && typeof imageItem.data === 'string') {
        // Check if imageItem.data looks like a file path with actual filename
        const itemDataPath = imageItem.data.split('/').pop().split('?')[0];
        if (itemDataPath && itemDataPath.includes('.') && !itemDataPath.startsWith('http')) {
          // Looks like a filename with extension
          originalFileName = itemDataPath;
          console.log(`📝 Using filename from imageItem.data: ${originalFileName}`);
        }
      }
      
      // 2. If no good filename from imageItem.data, try URL
      if (!originalFileName) {
        const urlFileName = imageUrl.split('/').pop().split('?')[0];
        if (urlFileName && urlFileName.includes('.') && urlFileName !== 'download') {
          originalFileName = urlFileName;
          console.log(`📝 Using filename from URL: ${originalFileName}`);
        }
      }
      
      // 3. Fallback to generated filename
      if (!originalFileName || originalFileName === '' || originalFileName === 'download') {
        originalFileName = `image_${Date.now()}.${extension}`;
        console.log(`📝 Using generated filename: ${originalFileName}`);
      }
      
      // Ensure proper extension
      if (!originalFileName.includes('.')) {
        originalFileName = `${originalFileName}.${extension}`;
      }
      
      // Add product identifier and unique suffix to filename to make it unique
      if (productIdentifier) {
        // Get the base name and extension
        const lastDotIndex = originalFileName.lastIndexOf('.');
        const baseName = lastDotIndex !== -1 ? originalFileName.substring(0, lastDotIndex) : originalFileName;
        const fileExt = lastDotIndex !== -1 ? originalFileName.substring(lastDotIndex) : `.${extension}`;
        
        // Add timestamp and random suffix to prevent filename collisions between multiple images
        const uniqueSuffix = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        // Create new filename with product identifier and unique suffix
        // Example: image.jpg becomes image_SKU123_1640995200000_abc123def.jpg
        originalFileName = `${baseName}_${productIdentifier}_${uniqueSuffix}${fileExt}`;
        console.log(`🏷️ Added unique filename with product identifier: ${originalFileName}`);
      }
      
      // Generate uniform path structure using StoragePathUtility
      const pathInfo = StoragePathUtility.generatePath(originalFileName, 'product');
      console.log(`🗂️  Generated uniform path: ${pathInfo.fullPath}`);
      
      // Create mock file object for storage upload
      const mockFile = {
        originalname: pathInfo.filename,
        mimetype: contentType,
        buffer: buffer,
        size: buffer.length
      };

      // Upload using unified storage manager with specific path
      if (storeId) {
        try {
          console.log(`☁️ [Akeneo] Uploading via storage manager for store: ${storeId}`);
          console.log(`[Akeneo] Upload options:`, {
            useOrganizedStructure: true,
            type: 'product',
            filename: pathInfo.filename,
            customPath: pathInfo.fullPath,
            public: true
          });
          
          const uploadResult = await storageManager.uploadFile(storeId, mockFile, {
            useOrganizedStructure: true,
            type: 'product',
            filename: pathInfo.filename,
            customPath: pathInfo.fullPath, // Use the uniform path structure
            public: true,
            metadata: {
              store_id: storeId,
              upload_type: 'akeneo_product_image',
              source: 'akeneo_import',
              original_url: imageUrl,
              relative_path: pathInfo.fullPath // Store relative path for database
            }
          });
          
          console.log(`[Akeneo] Upload result:`, uploadResult);
          
          if (uploadResult && (uploadResult.success || uploadResult.url)) {
            console.log(`✅ [Akeneo] Image uploaded via ${uploadResult.provider}: ${uploadResult.url}`);
            console.log(`📍 [Akeneo] Relative path: ${pathInfo.fullPath}`);
            
            return {
              url: uploadResult.url,
              originalUrl: imageUrl,
              filename: pathInfo.filename,
              relativePath: pathInfo.fullPath, // Add relative path for database storage
              size: buffer.length,
              contentType: contentType,
              uploadedTo: uploadResult.provider,
              fallbackUsed: uploadResult.fallbackUsed || false
            };
          } else {
            console.error(`❌ [Akeneo] Upload failed - no URL returned`);
            console.error(`[Akeneo] Full upload result:`, JSON.stringify(uploadResult, null, 2));
          }
        } catch (storageError) {
          console.log(`⚠️ Storage manager upload failed, trying local fallback: ${storageError.message}`);
        }
      }

      // Last resort fallback to local upload via API if storage manager fails
      const FormData = require('form-data');
      const fs = require('fs');
      const pathModule = require('path');
      const os = require('os');

      // Create temporary file for fallback
      const tempFilePath = pathModule.join(os.tmpdir(), pathInfo.filename);
      fs.writeFileSync(tempFilePath, buffer);
      
      // Create form data for local upload
      const formData = new FormData();
      formData.append('file', fs.createReadStream(tempFilePath), {
        filename: pathInfo.filename,
        contentType: contentType
      });
      
      // Upload to local file service
      const uploadResponse = await fetch('http://localhost:5000/api/upload', {
        method: 'POST',
        body: formData
      });
      
      // Clean up temporary file
      try {
        fs.unlinkSync(tempFilePath);
      } catch (unlinkError) {
        console.warn(`⚠️ Failed to delete temp file ${tempFilePath}:`, unlinkError.message);
      }
      
      if (!uploadResponse.ok) {
        throw new Error(`Local upload failed: HTTP ${uploadResponse.status}`);
      }
      
      const uploadResult = await uploadResponse.json();
      console.log(`✅ Image uploaded locally via API: ${uploadResult.file_url}`);
      
      return {
        url: uploadResult.file_url,
        originalUrl: imageUrl,
        filename: uploadResult.filename || fileName,
        size: buffer.length,
        contentType: contentType,
        uploadedTo: 'local-api'
      };
      
    } catch (error) {
      console.error(`❌ Failed to download and upload image ${imageUrl}:`, error.message);
      throw error;
    }
  }

  /**
   * Extract all attributes for the attributes JSON field
   * Now async to query attribute definitions for proper select/multiselect formatting
   * Uses database attribute types and Akeneo attribute metadata when available
   */
  async extractAllAttributes(values, locale = 'en_US', storeId = null, akeneoClient = null, customMappings = {}) {
    const attributes = {};
    
    // Create a set of explicitly mapped attributes to skip
    const explicitlyMappedAttributes = new Set();
    if (customMappings.attributes && Array.isArray(customMappings.attributes)) {
      customMappings.attributes.forEach(mapping => {
        if (mapping.enabled && mapping.akeneoAttribute && mapping.dainoField) {
          explicitlyMappedAttributes.add(mapping.akeneoAttribute);
        }
      });
    }
    
    // Get all attribute definitions from database for this store
    let databaseAttributeTypes = {};
    if (storeId) {
      try {
        const tenantDb = await ConnectionManager.getStoreConnection(storeId);
        const { data: dbAttributes, error } = await tenantDb
          .from('attributes')
          .select('code, type')
          .eq('store_id', storeId);

        if (error) throw error;

        // Create a lookup map for quick access
        if (dbAttributes && dbAttributes.length > 0) {
          dbAttributes.forEach(attr => {
            databaseAttributeTypes[attr.code] = {
              type: attr.type
            };
          });
        }
      } catch (error) {
        console.warn('Could not fetch attribute definitions from database:', error.message);
      }
    }

    // Get Akeneo attribute types if client is available
    let akeneoAttributeTypes = {};
    if (akeneoClient) {
      try {
        // Fetch Akeneo attributes to get their types
        const akeneoResponse = await akeneoClient.getAttributes({ limit: 100 });
        // Akeneo returns paginated response with _embedded.items
        const akeneoAttributes = akeneoResponse?._embedded?.items || akeneoResponse || [];
        if (Array.isArray(akeneoAttributes)) {
          akeneoAttributes.forEach(attr => {
            akeneoAttributeTypes[attr.code] = attr.type;
          });
        }
      } catch (error) {
        console.warn('Could not fetch Akeneo attribute types:', error.message);
      }
    }
    
    // Process each attribute value
    for (const attributeCode of Object.keys(values)) {
      // Skip attributes that have explicit custom mappings (they'll be mapped to product fields)
      if (explicitlyMappedAttributes.has(attributeCode)) {
        console.log(`⏭️ Skipping '${attributeCode}' - has explicit mapping to product field`);
        continue;
      }
      
      // First check database for attribute type to determine extraction method
      const dbAttrDef = databaseAttributeTypes[attributeCode];
      let rawValue = null;
      
      // For multiselect attributes, extract all values
      if (dbAttrDef?.type === 'multiselect') {
        const allValues = this.extractProductValues(values, attributeCode, locale);
        if (allValues && allValues.length > 0) {
          rawValue = allValues; // Array of values
        }
      } 
      // Check Akeneo type for multiselect
      else if (akeneoAttributeTypes[attributeCode] && 
               this.mapAttributeType(akeneoAttributeTypes[attributeCode]) === 'multiselect') {
        const allValues = this.extractProductValues(values, attributeCode, locale);
        if (allValues && allValues.length > 0) {
          rawValue = allValues; // Array of values
        }
      }
      // For all other attributes, use appropriate extraction method based on attribute type/name
      else {
        // Check if this is a numeric attribute that should be extracted as number
        const numericAttributes = [
          'price', 'sale_price', 'compare_price', 'cost_price', 'base_price', 'unit_price',
          'special_price', 'discounted_price', 'promo_price', 'msrp', 'regular_price', 'list_price',
          'weight', 'weight_kg', 'weight_lb', 'length', 'width', 'height', 'depth', 'diameter',
          'stock_quantity', 'quantity', 'low_stock_threshold', 'minimum_quantity', 'maximum_quantity'
        ];
        
        // Check database attribute type first
        if (dbAttrDef?.type === 'number') {
          rawValue = this.extractNumericValue(values, attributeCode, locale);
        }
        // Check Akeneo attribute type
        else if (akeneoAttributeTypes[attributeCode] && 
                 ['pim_catalog_number', 'pim_catalog_metric', 'pim_catalog_price_collection'].includes(akeneoAttributeTypes[attributeCode])) {
          rawValue = this.extractNumericValue(values, attributeCode, locale);
        }
        // Check attribute name patterns for numeric fields
        else if (numericAttributes.includes(attributeCode) || 
                 attributeCode.endsWith('_price') || attributeCode.endsWith('_weight') || 
                 attributeCode.endsWith('_quantity') || attributeCode.includes('price_') ||
                 attributeCode.includes('weight_') || attributeCode.includes('dimension')) {
          rawValue = this.extractNumericValue(values, attributeCode, locale);
        }
        // For boolean attributes
        else if (dbAttrDef?.type === 'boolean' || 
                 akeneoAttributeTypes[attributeCode] === 'pim_catalog_boolean') {
          rawValue = this.extractBooleanValue(values, attributeCode, locale);
        }
        // Default to regular product value extraction
        else {
          rawValue = this.extractProductValue(values, attributeCode, locale);
        }
      }
      
      if (rawValue !== null && rawValue !== undefined) {
        // Check if we have type information from database
        if (dbAttrDef && (dbAttrDef.type === 'select' || dbAttrDef.type === 'multiselect')) {
          // Use database definition for known attributes
          attributes[attributeCode] = this.formatAttributeWithDefinition(rawValue, dbAttrDef);
        } 
        // Check if we have Akeneo type information
        else if (akeneoAttributeTypes[attributeCode]) {
          const akeneoType = akeneoAttributeTypes[attributeCode];
          const mappedType = this.mapAttributeType(akeneoType);
          
          if (mappedType === 'select') {
            // Format as select option
            attributes[attributeCode] = this.formatAsSelectOption(rawValue);
          } else if (mappedType === 'multiselect') {
            // Format as multiselect options (rawValue is already an array from extraction above)
            attributes[attributeCode] = this.formatAsMultiselectOptions(rawValue);
          } else {
            // Keep as regular attribute
            attributes[attributeCode] = rawValue;
          }
        }
        // Last resort: analyze data structure (but no hardcoded name patterns)
        else {
          // Only use data structure analysis, not name patterns
          if (Array.isArray(rawValue) && rawValue.length > 0 && 
              rawValue.every(val => typeof val === 'string' && val.length < 100)) {
            // Multiple short string values suggest multiselect
            attributes[attributeCode] = this.formatAsMultiselectOptions(rawValue);
          } else if (typeof rawValue === 'string' && rawValue.length < 50 && 
                     !rawValue.includes(' ') && !rawValue.includes('\n')) {
            // Short single-word string might be a select option
            // But only format if it looks like an option value (kebab-case, snake_case, or simple word)
            if (rawValue.includes('-') || rawValue.includes('_') || /^[a-z]+$/i.test(rawValue)) {
              attributes[attributeCode] = this.formatAsSelectOption(rawValue);
            } else {
              attributes[attributeCode] = rawValue;
            }
          } else {
            // Keep as regular attribute
            attributes[attributeCode] = rawValue;
          }
        }
      }
    }

    return attributes;
  }

  /**
   * Format attribute using database definition
   * Note: Options are stored in attribute_values table, not in attributes table
   * This method formats values as {label, value} objects for select/multiselect types
   */
  formatAttributeWithDefinition(rawValue, attrDef) {
    if (attrDef.type === 'select') {
      // For single select, format as {label, value}
      if (typeof rawValue === 'string') {
        return {
          label: rawValue,
          value: rawValue
        };
      } else {
        return rawValue; // Keep as-is if not string
      }

    } else if (attrDef.type === 'multiselect') {
      // For multiselect, format as array of {label, value} objects
      if (Array.isArray(rawValue)) {
        return rawValue.map(val => {
          if (typeof val === 'string') {
            return {
              label: val,
              value: val
            };
          }
          return val; // Keep as-is if not string
        });
      } else if (typeof rawValue === 'string') {
        // Single value for multiselect - convert to array
        return [{
          label: rawValue,
          value: rawValue
        }];
      } else {
        return rawValue; // Keep as-is if not string/array
      }
    }

    return rawValue;
  }

  /**
   * Detect if an attribute should be treated as select/multiselect based on data patterns
   * This helps process attributes that don't exist in the database yet
   */
  detectAttributeTypeFromData(attributeCode, rawValue, allValues) {
    // Common select/multiselect attribute patterns in e-commerce
    const selectPatterns = [
      'color', 'colour', 'size', 'brand', 'material', 'style', 'category', 'type',
      'status', 'condition', 'gender', 'age_group', 'season', 'occasion',
      'fit', 'pattern', 'finish', 'grade', 'rating', 'level'
    ];
    
    const multiselectPatterns = [
      'tags', 'categories', 'collections', 'features', 'benefits', 'styles',
      'colors', 'colours', 'sizes', 'materials', 'occasions', 'keywords'
    ];
    
    // Check if attribute name matches known select patterns
    const lowerCode = attributeCode.toLowerCase();
    if (selectPatterns.some(pattern => lowerCode.includes(pattern))) {
      // If the value is an array with multiple items, it's likely multiselect
      if (Array.isArray(rawValue) && rawValue.length > 1) {
        return 'multiselect';
      }
      return 'select';
    }
    
    // Check if attribute name matches known multiselect patterns
    if (multiselectPatterns.some(pattern => lowerCode.includes(pattern))) {
      return 'multiselect';
    }
    
    // Check data structure patterns
    if (Array.isArray(rawValue) && rawValue.length > 0) {
      // Multiple string values suggest multiselect
      if (rawValue.every(val => typeof val === 'string' && val.length < 100)) {
        return 'multiselect';
      }
    } else if (typeof rawValue === 'string') {
      // Short string values that look like options
      if (rawValue.length < 50 && !rawValue.includes(' ') && 
          (rawValue.includes('-') || rawValue.includes('_') || /^[a-z]+$/i.test(rawValue))) {
        return 'select';
      }
    }
    
    return 'text'; // Default to text attribute
  }

  /**
   * Format value as select option
   */
  formatAsSelectOption(rawValue) {
    if (typeof rawValue === 'string') {
      return {
        label: this.formatLabelFromValue(rawValue),
        value: rawValue
      };
    }
    return rawValue;
  }

  /**
   * Format value as multiselect options
   */
  formatAsMultiselectOptions(rawValue) {
    if (Array.isArray(rawValue)) {
      return rawValue.map(val => {
        if (typeof val === 'string') {
          return {
            label: this.formatLabelFromValue(val),
            value: val
          };
        }
        return val;
      });
    } else if (typeof rawValue === 'string') {
      // Single value - convert to array
      return [{
        label: this.formatLabelFromValue(rawValue),
        value: rawValue
      }];
    }
    return rawValue;
  }

  /**
   * Format a value into a human-readable label
   */
  formatLabelFromValue(value) {
    if (typeof value !== 'string') return value;
    
    // Convert snake_case and kebab-case to Title Case
    return value
      .replace(/[-_]/g, ' ')
      .replace(/\b\w/g, l => l.toUpperCase())
      .trim();
  }

  /**
   * Extract SEO data from product attributes
   */
  extractSeoData(values, locale = 'en_US') {
    return {
      meta_title: this.extractProductValue(values, 'meta_title', locale),
      meta_description: this.extractProductValue(values, 'meta_description', locale),
      meta_keywords: this.extractProductValue(values, 'meta_keywords', locale)
    };
  }

  /**
   * Generate URL-friendly slug from text
   */
  generateSlug(text) {
    if (!text || typeof text !== 'string') return '';
    
    return text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  }

  /**
   * Build category hierarchy from flat Akeneo categories
   */
  buildCategoryHierarchy(akeneoCategories, dainoCategories) {
    // Create a map of Akeneo codes to original Akeneo categories to check hierarchy
    const akeneoCodeToCategory = {};
    akeneoCategories.forEach(akeneoCategory => {
      akeneoCodeToCategory[akeneoCategory.code] = akeneoCategory;
    });
    
    // Create a map of Akeneo codes to DainoStore categories
    const codeToCategory = {};
    dainoCategories.forEach(category => {
      codeToCategory[category._temp_akeneo_code] = category;
    });

    // Set parent relationships and calculate levels based on Akeneo hierarchy
    dainoCategories.forEach(category => {
      const akeneoCategory = akeneoCodeToCategory[category._temp_akeneo_code];
      
      if (!akeneoCategory) {
        console.warn(`⚠️ Akeneo category not found for code: ${category._temp_akeneo_code}`);
        // Default to root if Akeneo category not found
        category.level = 0;
        category.path = category._temp_akeneo_code;
        category.isRoot = true;
        category.parent_id = null;
        return;
      }

      // Check if this category has a parent in Akeneo
      if (akeneoCategory.parent && akeneoCategory.parent !== null) {
        const parentCategory = codeToCategory[akeneoCategory.parent];
        if (parentCategory) {
          // This category has a valid parent
          category._temp_parent_akeneo_code = akeneoCategory.parent;
          category.level = (parentCategory.level || 0) + 1;
          category.path = parentCategory.path ? 
            `${parentCategory.path}/${category._temp_akeneo_code}` : 
            category._temp_akeneo_code;
          category.isRoot = false;
          console.log(`📎 "${category.name}" (${category._temp_akeneo_code}) has parent: ${akeneoCategory.parent}`);
        } else {
          // Parent specified but not found in our import, make it root
          console.log(`⚠️ Parent "${akeneoCategory.parent}" not found for "${category.name}", making it a root category`);
          category.level = 0;
          category.path = category._temp_akeneo_code;
          category.isRoot = true;
          category.parent_id = null;
        }
      } else {
        // No parent specified in Akeneo, this is a root category
        console.log(`🌱 "${category.name}" (${category._temp_akeneo_code}) is a root category (no parent in Akeneo)`);
        category.level = 0;
        category.path = category._temp_akeneo_code;
        category.isRoot = true;
        category.parent_id = null;
      }
    });

    // Sort by level to ensure parents are processed before children
    dainoCategories.sort((a, b) => a.level - b.level);

    return dainoCategories;
  }

  /**
   * Map Akeneo category codes to DainoStore category IDs
   */
  mapCategoryIds(akeneoCategoryCodes, categoryMapping) {
    const mappedIds = [];
    const unmappedCodes = [];
    
    akeneoCategoryCodes.forEach(code => {
      const mappedId = categoryMapping[code];
      if (mappedId) {
        mappedIds.push(mappedId);
      } else {
        unmappedCodes.push(code);
      }
    });
    
    // Log unmapped categories for debugging (only in development or if there are issues)
    if (unmappedCodes.length > 0 && process.env.NODE_ENV === 'development') {
      console.warn(`⚠️ Unmapped category codes: ${unmappedCodes.join(', ')}`);
    }
    
    return mappedIds;
  }

  /**
   * Validate transformed category
   */
  validateCategory(category) {
    const errors = [];
    
    if (!category.name || category.name.trim() === '') {
      errors.push('Category name is required');
    }
    
    if (!category.store_id) {
      errors.push('Store ID is required');
    }

    return errors;
  }

  /**
   * Transform Akeneo family to DainoStore AttributeSet format
   */
  transformFamily(akeneoFamily, storeId) {
    const dainoAttributeSet = {
      store_id: storeId,
      name: `akeneo_${akeneoFamily.code}`, // Prefix with "akeneo_" to identify source
      description: null,
      attribute_ids: [], // Will be populated after attributes are imported
      // Keep original Akeneo data for reference
      akeneo_code: akeneoFamily.code,
      akeneo_attribute_codes: akeneoFamily.attributes || []
    };

    return dainoAttributeSet;
  }

  /**
   * Transform Akeneo attribute to DainoStore Attribute format
   */
  transformAttribute(akeneoAttribute, storeId, locale = 'en_US', fetchedOptions = null) {
    const dainoAttribute = {
      store_id: storeId,
      name: this.extractLocalizedValue(akeneoAttribute.labels, locale) || akeneoAttribute.code,
      code: akeneoAttribute.code,
      type: this.mapAttributeType(akeneoAttribute.type),
      is_required: akeneoAttribute.required || false,
      is_filterable: akeneoAttribute.useable_as_grid_filter || false,
      is_searchable: akeneoAttribute.searchable || false,
      is_usable_in_conditions: akeneoAttribute.useable_as_grid_filter || false,
      filter_type: this.mapFilterType(akeneoAttribute.type),
      options: this.extractAttributeOptions(akeneoAttribute, fetchedOptions),
      file_settings: this.extractFileSettings(akeneoAttribute),
      sort_order: akeneoAttribute.sort_order || 0,
      // Keep original Akeneo data for reference
      akeneo_code: akeneoAttribute.code,
      akeneo_type: akeneoAttribute.type,
      akeneo_group: akeneoAttribute.group
    };

    return dainoAttribute;
  }

  /**
   * Map Akeneo attribute type to DainoStore attribute type
   */
  mapAttributeType(akeneoType) {
    const typeMapping = {
      'pim_catalog_text': 'text',
      'pim_catalog_textarea': 'text',
      'pim_catalog_number': 'number',
      'pim_catalog_price_collection': 'number',
      'pim_catalog_simpleselect': 'select',
      'pim_catalog_multiselect': 'multiselect',
      'pim_catalog_boolean': 'boolean',
      'pim_catalog_date': 'date',
      'pim_catalog_file': 'file',
      'pim_catalog_image': 'file',
      'pim_catalog_identifier': 'text'
    };

    return typeMapping[akeneoType] || 'text';
  }

  /**
   * Map Akeneo attribute type to filter type
   */
  mapFilterType(akeneoType) {
    const filterMapping = {
      'pim_catalog_simpleselect': 'select',
      'pim_catalog_multiselect': 'multiselect',
      'pim_catalog_number': 'slider',
      'pim_catalog_price_collection': 'slider'
    };

    return filterMapping[akeneoType] || null;
  }

  /**
   * Extract attribute options from Akeneo attribute
   */
  extractAttributeOptions(akeneoAttribute, fetchedOptions = null) {
    // If we have fetched options from the API, use those first
    if (fetchedOptions && Array.isArray(fetchedOptions) && fetchedOptions.length > 0) {
      console.log(`🔗 Using ${fetchedOptions.length} fetched options for attribute: ${akeneoAttribute.code}`);
      return fetchedOptions.map((option, index) => {
        const label = this.extractLocalizedValue(option.labels) || option.code;
        return {
          code: option.code,
          label: label,
          value: label, // Set value same as label for consistency
          sort_order: option.sort_order || index
        };
      });
    }

    // Fallback to embedded options in attribute object (legacy)
    if (!akeneoAttribute.options) return [];

    console.log(`📦 Using embedded options for attribute: ${akeneoAttribute.code}`);
    return Object.keys(akeneoAttribute.options).map(optionCode => {
      const label = this.extractLocalizedValue(akeneoAttribute.options[optionCode].labels) || optionCode;
      return {
        code: optionCode,
        label: label,
        value: label, // Set value same as label for consistency
        sort_order: akeneoAttribute.options[optionCode].sort_order || 0
      };
    });
  }

  /**
   * Extract file settings from Akeneo attribute
   */
  extractFileSettings(akeneoAttribute) {
    if (akeneoAttribute.type !== 'pim_catalog_file' && akeneoAttribute.type !== 'pim_catalog_image') {
      return {};
    }

    return {
      allowed_extensions: akeneoAttribute.allowed_extensions || [],
      max_file_size: akeneoAttribute.max_file_size || null
    };
  }

  /**
   * Validate transformed family
   */
  validateFamily(family) {
    const errors = [];
    
    if (!family.name || family.name.trim() === '') {
      errors.push('Family name is required');
    }
    
    if (!family.store_id) {
      errors.push('Store ID is required');
    }

    return errors;
  }

  /**
   * Validate transformed attribute
   */
  validateAttribute(attribute) {
    const errors = [];
    
    if (!attribute.name || attribute.name.trim() === '') {
      errors.push('Attribute name is required');
    }
    
    if (!attribute.code || attribute.code.trim() === '') {
      errors.push('Attribute code is required');
    }
    
    if (!attribute.store_id) {
      errors.push('Store ID is required');
    }

    return errors;
  }

  /**
   * Validate transformed product
   */
  validateProduct(product) {
    const errors = [];
    
    if (!product.name || product.name.trim() === '') {
      errors.push('Product name is required');
    }
    
    if (!product.sku || product.sku.trim() === '') {
      errors.push('Product SKU is required');
    }
    
    if (!product.store_id) {
      errors.push('Store ID is required');
    }
    
    if (product.price < 0) {
      errors.push('Product price cannot be negative');
    }

    return errors;
  }

  /**
   * Comprehensive attribute mapping system for any Akeneo attribute
   * Allows flexible mapping of Akeneo attributes to DainoStore product fields
   */
  mapAkeneoAttribute(akeneoProduct, attributeMapping, locale = 'en_US') {
    const { values } = akeneoProduct;
    const { 
      akeneoAttribute, 
      dainoField,
      dataType = 'string', 
      fallbacks = [], 
      transform = null,
      defaultValue = null 
    } = attributeMapping;
    
    console.log(`🗺️ Mapping Akeneo attribute '${akeneoAttribute}' to DainoStore field '${dainoField}'`);
    
    // Try primary attribute first
    let value = this.extractProductValue(values, akeneoAttribute, locale);
    
    // Try fallback attributes if primary value is null/empty
    if ((value === null || value === undefined || value === '') && fallbacks.length > 0) {
      for (const fallbackAttr of fallbacks) {
        console.log(`🔄 Trying fallback attribute: ${fallbackAttr}`);
        value = this.extractProductValue(values, fallbackAttr, locale);
        if (value !== null && value !== undefined && value !== '') {
          console.log(`✅ Found value in fallback attribute '${fallbackAttr}': ${value}`);
          break;
        }
      }
    }
    
    // Auto-detect price fields and force numeric conversion even if dataType not explicitly set
    const priceFields = [
      'price', 'sale_price', 'special_price', 'compare_price', 'cost_price', 
      'msrp', 'list_price', 'regular_price', 'base_price', 'unit_price',
      'discounted_price', 'promo_price'
    ];
    const isPrice = priceFields.includes(akeneoAttribute) || priceFields.includes(dainoField);
    
    // Apply data type conversion
    if (value !== null && value !== undefined && value !== '') {
      switch (dataType) {
        case 'number':
        case 'numeric':
          // Convert the extracted value to numeric format
          value = this.convertValueToNumeric(value);
          break;
        case 'boolean':
          // Convert the extracted value to boolean
          value = this.convertValueToBoolean(value);
          break;
        case 'array':
          if (!Array.isArray(value)) {
            value = [value];
          }
          break;
        case 'string':
        default:
          // Auto-detect price fields and convert to numeric even if dataType is 'string'
          if (isPrice) {
            console.log(`💰 Auto-detected price field: ${akeneoAttribute} -> ${dainoField}, applying numeric conversion`);
            value = this.convertValueToNumeric(value);
          }
          // Otherwise keep as string (already handled by extractProductValue)
          break;
      }
    }
    
    // Apply custom transformation function if provided
    if (transform && typeof transform === 'function') {
      try {
        value = transform(value, akeneoProduct, locale);
        console.log(`🔧 Applied custom transformation to '${akeneoAttribute}'`);
      } catch (transformError) {
        console.warn(`⚠️ Transform function failed for '${akeneoAttribute}':`, transformError.message);
      }
    }
    
    // Use default value if still null/empty
    if ((value === null || value === undefined || value === '') && defaultValue !== null) {
      value = defaultValue;
      console.log(`🎯 Using default value for '${dainoField}': ${defaultValue}`);
    }
    
    return { [dainoField]: value };
  }

  /**
   * Apply multiple attribute mappings to an Akeneo product
   * If no mapping is provided for an Akeneo attribute, it will automatically map to a DainoStore field with the same name
   */
  applyCustomAttributeMappings(akeneoProduct, mappings = [], locale = 'en_US') {
    const customAttributes = {};
    const values = akeneoProduct.values || {};
    
    // Create a map of explicit mappings for quick lookup
    const explicitMappings = new Map();
    if (Array.isArray(mappings) && mappings.length > 0) {
      mappings.forEach(mapping => {
        if (mapping.enabled && mapping.akeneoAttribute) {
          explicitMappings.set(mapping.akeneoAttribute, mapping);
        }
      });
    }
    
    // First, process all explicit mappings
    explicitMappings.forEach((mapping, akeneoAttribute) => {
      if (mapping.dainoField && values.hasOwnProperty(akeneoAttribute)) {
        const mappedValue = this.mapAkeneoAttribute(akeneoProduct, mapping, locale);
        Object.assign(customAttributes, mappedValue);
        console.log(`✅ Applied explicit mapping: ${akeneoAttribute} -> ${mapping.dainoField}`);
      }
    });
    
    // Then, process remaining attributes that don't have explicit mappings
    Object.keys(values).forEach(akeneoAttribute => {
      // Skip if already processed in standard fields
      const standardFields = ['name', 'description', 'price', 'sku', 'weight', 'ean', 'barcode'];
      if (standardFields.includes(akeneoAttribute)) {
        return;
      }
      
      // Skip if this attribute has an explicit mapping (already processed above)
      if (explicitMappings.has(akeneoAttribute)) {
        return;
      }
      
      // Default behavior: map to the same field name in DainoStore attributes
      const value = this.extractProductValue(values, akeneoAttribute, locale);
      if (value !== null && value !== undefined && value !== '') {
        // Store in attributes JSON field
        if (!customAttributes.attributes) {
          customAttributes.attributes = {};
        }
        customAttributes.attributes[akeneoAttribute] = value;
        console.log(`🔄 Auto-mapped attribute: ${akeneoAttribute} -> attributes.${akeneoAttribute}`);
      }
    });
    
    // Process explicit mappings for attributes not found in product values  
    // (useful for mappings with default values)
    explicitMappings.forEach((mapping, akeneoAttribute) => {
      if (!values.hasOwnProperty(akeneoAttribute)) {
        // This attribute doesn't exist in the product, but we might have a default value
        if (mapping.defaultValue !== null && mapping.defaultValue !== undefined) {
          try {
            const mappedValue = this.mapAkeneoAttribute(akeneoProduct, mapping, locale);
            Object.assign(customAttributes, mappedValue);
            console.log(`🎯 Applied mapping with default value: ${akeneoAttribute} -> ${mapping.dainoField}`);
          } catch (mappingError) {
            console.error(`❌ Failed to map '${akeneoAttribute}' → '${mapping.dainoField}':`, mappingError.message);
          }
        }
      }
    });
    
    return customAttributes;
  }

  /**
   * Enhanced attribute extraction for common e-commerce fields
   */
  extractCommonAttributes(values, locale = 'en_US') {
    const commonAttributes = {};
    
    // Price-related attributes with multiple fallbacks
    commonAttributes.price = this.extractNumericValue(values, 'price', locale) ||
                             this.extractNumericValue(values, 'base_price', locale) ||
                             this.extractNumericValue(values, 'unit_price', locale);
    
    // compare_price - do NOT auto-extract sale_price here, let custom mappings handle it
    commonAttributes.compare_price = this.extractNumericValue(values, 'compare_price', locale) ||
                                     this.extractNumericValue(values, 'msrp', locale) ||
                                     this.extractNumericValue(values, 'regular_price', locale) ||
                                     this.extractNumericValue(values, 'list_price', locale);
    
    // Brand and manufacturer
    commonAttributes.brand = this.extractProductValue(values, 'brand', locale) ||
                            this.extractProductValue(values, 'manufacturer', locale) ||
                            this.extractProductValue(values, 'supplier', locale);
    
    // Material and composition
    commonAttributes.material = this.extractProductValue(values, 'material', locale) ||
                               this.extractProductValue(values, 'composition', locale) ||
                               this.extractProductValue(values, 'fabric', locale);
    
    // Color variations
    commonAttributes.color = this.extractProductValue(values, 'color', locale) ||
                            this.extractProductValue(values, 'colour', locale) ||
                            this.extractProductValue(values, 'main_color', locale);
    
    // Size information
    commonAttributes.size = this.extractProductValue(values, 'size', locale) ||
                           this.extractProductValue(values, 'clothing_size', locale) ||
                           this.extractProductValue(values, 'shoe_size', locale);
    
    // Warranty and care instructions
    commonAttributes.warranty = this.extractProductValue(values, 'warranty', locale) ||
                               this.extractProductValue(values, 'warranty_period', locale) ||
                               this.extractProductValue(values, 'guarantee', locale);
    
    commonAttributes.care_instructions = this.extractProductValue(values, 'care_instructions', locale) ||
                                         this.extractProductValue(values, 'care_guide', locale) ||
                                         this.extractProductValue(values, 'maintenance', locale);
    
    return commonAttributes;
  }

  /**
   * Convert a value to numeric format with proper error handling
   * Handles complex Akeneo data structures that might contain nested objects
   */
  convertValueToNumeric(value) {
    if (value === null || value === undefined) return null;
    
    // If it's already a number, return it
    if (typeof value === 'number') {
      return isNaN(value) ? null : value;
    }
    
    // If it's a string, try to parse it
    if (typeof value === 'string') {
      const numericValue = parseFloat(value);
      return isNaN(numericValue) ? null : numericValue;
    }
    
    // If it's an array, try to extract numeric value from first element
    if (Array.isArray(value) && value.length > 0) {
      return this.convertValueToNumeric(value[0]);
    }
    
    // If it's an object, try various common structures
    if (typeof value === 'object' && value !== null) {
      // Try common numeric object structures
      if (value.amount !== undefined) {
        return this.convertValueToNumeric(value.amount);
      }
      if (value.value !== undefined) {
        return this.convertValueToNumeric(value.value);
      }
      if (value.price !== undefined) {
        return this.convertValueToNumeric(value.price);
      }
      if (value.number !== undefined) {
        return this.convertValueToNumeric(value.number);
      }
      
      // Log complex objects that couldn't be converted
      console.warn(`⚠️ Could not convert complex object to numeric:`, JSON.stringify(value));
      return null;
    }
    
    console.warn(`⚠️ Cannot convert value to numeric (type: ${typeof value}):`, value);
    return null;
  }

  /**
   * Convert a value to boolean format with proper error handling
   */
  convertValueToBoolean(value) {
    if (value === null || value === undefined) return null;
    
    // Direct boolean
    if (typeof value === 'boolean') return value;
    
    // String boolean values
    if (typeof value === 'string') {
      const lowerValue = value.toLowerCase().trim();
      if (['true', '1', 'yes', 'on', 'enabled', 'active'].includes(lowerValue)) {
        return true;
      }
      if (['false', '0', 'no', 'off', 'disabled', 'inactive'].includes(lowerValue)) {
        return false;
      }
      return null;
    }
    
    // Number to boolean
    if (typeof value === 'number') {
      return value !== 0;
    }
    
    // Array - check if not empty
    if (Array.isArray(value)) {
      return value.length > 0;
    }
    
    // Object - try to extract boolean value
    if (typeof value === 'object' && value !== null) {
      if (value.value !== undefined) {
        return this.convertValueToBoolean(value.value);
      }
      if (value.enabled !== undefined) {
        return this.convertValueToBoolean(value.enabled);
      }
      return null;
    }
    
    return Boolean(value);
  }

  /**
   * Enhanced extractNumericValue with better error handling and logging
   */
  extractNumericValueWithDebug(values, attributeCode, locale = 'en_US', productIdentifier = null) {
    console.log(`🔢 [${productIdentifier || 'Unknown'}] Extracting numeric value for attribute: ${attributeCode}`);
    
    const value = this.extractProductValue(values, attributeCode, locale);
    
    if (value === null || value === undefined) {
      console.log(`  ℹ️ No value found for ${attributeCode}`);
      return null;
    }
    
    console.log(`  📊 Raw value for ${attributeCode}:`, JSON.stringify(value));
    console.log(`  📋 Type: ${typeof value}`);
    
    let result = null;
    
    try {
      // Handle Akeneo price collection format: [{ amount: "29.99", currency: "USD" }]
      if (Array.isArray(value) && value.length > 0) {
        console.log(`  🔄 Processing array with ${value.length} items`);
        // For price collections, get the first price's amount
        const firstPrice = value[0];
        if (firstPrice && typeof firstPrice === 'object' && firstPrice.amount !== undefined) {
          result = parseFloat(firstPrice.amount);
          console.log(`  ✅ Extracted from price collection: ${result}`);
        } else {
          console.log(`  ⚠️ Array item doesn't have expected structure:`, firstPrice);
          result = null;
        }
      }
      // Handle single Akeneo price object: { amount: "29.99", currency: "USD" }
      else if (typeof value === 'object' && value !== null && !Array.isArray(value) && value.amount !== undefined) {
        result = parseFloat(value.amount);
        console.log(`  ✅ Extracted from price object: ${result}`);
      }
      // Handle simple numeric values (string or number)
      else if (typeof value === 'string' || typeof value === 'number') {
        result = parseFloat(value);
        console.log(`  ✅ Extracted from simple value: ${result}`);
      }
      // Handle other object structures
      else if (typeof value === 'object' && value !== null) {
        console.log(`  🔍 Attempting to extract from complex object...`);
        result = this.convertValueToNumeric(value);
        console.log(`  📊 Conversion result: ${result}`);
      }
      else {
        console.log(`  ❌ Unsupported value type for numeric conversion: ${typeof value}`);
        result = null;
      }
      
      // Validate the result
      if (result !== null && isNaN(result)) {
        console.log(`  ❌ Conversion resulted in NaN, returning null`);
        result = null;
      }
      
      console.log(`  🎯 Final result for ${attributeCode}: ${result} (type: ${typeof result})`);
      
    } catch (error) {
      console.error(`  ❌ Error extracting numeric value for ${attributeCode}:`, error.message);
      console.error(`  📍 Raw value:`, JSON.stringify(value));
      result = null;
    }
    
    return result;
  }

  /**
   * Debug method to analyze all product attributes and identify potential numeric conversion issues
   */
  debugProductAttributes(akeneoProduct, locale = 'en_US') {
    const values = akeneoProduct.values || {};
    const productId = akeneoProduct.identifier || 'Unknown';
    
    console.log(`\n🔍 ===== DEBUGGING PRODUCT ATTRIBUTES: ${productId} =====`);
    console.log(`📊 Total attributes: ${Object.keys(values).length}`);
    
    const potentialNumericAttributes = [];
    const problematicAttributes = [];
    
    Object.keys(values).forEach(attributeCode => {
      const attributeData = values[attributeCode];
      
      // Check if this looks like a numeric attribute
      const isNumericName = attributeCode.includes('price') || 
                           attributeCode.includes('weight') || 
                           attributeCode.includes('quantity') || 
                           attributeCode.includes('threshold') ||
                           attributeCode.includes('cost') ||
                           attributeCode.includes('msrp') ||
                           attributeCode.includes('number') ||
                           attributeCode.includes('amount');
      
      if (isNumericName) {
        potentialNumericAttributes.push(attributeCode);
        
        // Extract and analyze the value
        const rawValue = this.extractProductValue(values, attributeCode, locale);
        
        console.log(`\n📋 NUMERIC ATTRIBUTE: ${attributeCode}`);
        console.log(`  📊 Raw data:`, JSON.stringify(attributeData, null, 2));
        console.log(`  📊 Extracted value:`, rawValue);
        console.log(`  📊 Value type:`, typeof rawValue);
        
        // Test numeric conversion
        try {
          const numericResult = this.extractNumericValue(values, attributeCode, locale);
          console.log(`  ✅ Numeric conversion: ${numericResult} (type: ${typeof numericResult})`);
          
          // Check if this would cause the "[object Object]" error
          if (typeof rawValue === 'object' && rawValue !== null && numericResult === null) {
            console.log(`  ⚠️ WARNING: This attribute might cause "[object Object]" error!`);
            console.log(`  🔧 Object stringifies to: "${String(rawValue)}"`);
            problematicAttributes.push({
              attributeCode,
              rawValue,
              stringValue: String(rawValue),
              issue: 'Complex object cannot be converted to numeric'
            });
          }
        } catch (error) {
          console.log(`  ❌ Numeric conversion error: ${error.message}`);
          problematicAttributes.push({
            attributeCode,
            rawValue,
            error: error.message,
            issue: 'Conversion throws error'
          });
        }
      }
    });
    
    console.log(`\n📊 Summary for ${productId}:`);
    console.log(`  🔢 Potential numeric attributes found: ${potentialNumericAttributes.length}`);
    console.log(`  ⚠️ Problematic attributes: ${problematicAttributes.length}`);
    
    if (problematicAttributes.length > 0) {
      console.log(`\n❌ PROBLEMATIC ATTRIBUTES THAT MIGHT CAUSE ERRORS:`);
      problematicAttributes.forEach((attr, index) => {
        console.log(`  ${index + 1}. ${attr.attributeCode}:`);
        console.log(`     Issue: ${attr.issue}`);
        console.log(`     String value: "${attr.stringValue || 'N/A'}"`);
        if (attr.error) console.log(`     Error: ${attr.error}`);
      });
    }
    
    console.log(`===============================================\n`);
    
    return {
      productId,
      totalAttributes: Object.keys(values).length,
      potentialNumericAttributes,
      problematicAttributes
    };
  }
}

module.exports = AkeneoMapping;