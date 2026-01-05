/**
 * Generic API Tool Service
 *
 * Provides a small set of generic tools that work DIRECTLY with the database.
 * The LLM uses RAG context to understand the store architecture.
 *
 * ARCHITECTURE:
 * 1. User says "Add a mega menu with categories"
 * 2. LLM reads architecture docs from RAG context
 * 3. LLM decides: configure_layout(operation="add_slot", slotType="mega-menu", ...)
 * 4. This service writes directly to slot_configurations table
 * 5. Result returned to LLM for response generation
 *
 * KEY TABLES:
 * - slot_configurations: Page layouts (header, product, category, cart, etc.)
 * - products: Product data
 * - categories: Category data
 * - orders: Order data
 * - customers: Customer data
 * - coupons: Discount coupons
 */

const axios = require('axios');
const ConnectionManager = require('./database/ConnectionManager');

class GenericApiToolService {
  constructor() {
    // Base URL for internal API calls
    this.baseUrl = process.env.API_BASE_URL || 'http://localhost:3001';

    // API categories for context
    this.apiCategories = {
      products: ['products', 'product-images', 'product-labels', 'product-tabs', 'configurable-products'],
      categories: ['categories', 'category-images'],
      orders: ['orders', 'cart', 'payments', 'payment-methods', 'shipping', 'delivery', 'tax'],
      customers: ['customers', 'addresses', 'wishlist', 'customer-activity'],
      content: ['cms', 'cms-blocks', 'translations', 'languages'],
      layout: ['slot-configurations', 'slotConfigurations', 'storefronts', 'theme-defaults'],
      seo: ['seo-settings', 'seo-templates', 'redirects', 'canonical-urls', 'robots', 'sitemap'],
      marketing: ['coupons', 'campaigns', 'automations', 'segments', 'email-templates', 'crm'],
      media: ['images', 'file-manager', 'image-optimization', 'storage'],
      settings: ['domains', 'domain-settings', 'cookie-consent-settings', 'gdpr'],
      integrations: ['integrations', 'shopify', 'amazon', 'ebay', 'meta-commerce', 'webhook-integrations'],
      plugins: ['plugins', 'store-plugins', 'extensions', 'dynamic-plugins'],
      analytics: ['analytics', 'analytics-dashboard', 'ab-testing', 'heatmap', 'custom-analytics-events'],
      attributes: ['attributes', 'attribute-sets']
    };
  }

  /**
   * Get all generic tool definitions
   * These are the tools the LLM can use to interact with any API
   */
  getTools() {
    return [
      // 1. GENERIC API CALLER - Most flexible tool
      {
        name: 'call_api',
        description: `Make an API call to any endpoint. Use this when you know the exact endpoint to call.
The API base is already set - just provide the path starting with /api/.
Common endpoints:
- Products: /api/products, /api/products/:id
- Categories: /api/categories, /api/categories/:id
- Orders: /api/orders, /api/orders/:id
- Customers: /api/customers
- CMS: /api/cms, /api/cms-blocks
- Slots: /api/slot-configurations/:pageType
- Settings: /api/settings
- And 100+ more endpoints available`,
        input_schema: {
          type: 'object',
          properties: {
            method: {
              type: 'string',
              enum: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
              description: 'HTTP method'
            },
            endpoint: {
              type: 'string',
              description: 'API endpoint path starting with /api/ (e.g., /api/products, /api/categories/123)'
            },
            data: {
              type: 'object',
              description: 'Request body for POST/PUT/PATCH requests'
            },
            params: {
              type: 'object',
              description: 'Query parameters for GET requests (e.g., { page: 1, limit: 10 })'
            }
          },
          required: ['method', 'endpoint']
        }
      },

      // 2. LIST/QUERY DATA - Simplified read operations
      {
        name: 'list_data',
        description: `List or search data from any entity. Use this for reading/querying data.
Available entities: products, categories, orders, customers, coupons, cms-pages, cms-blocks,
attributes, shipping-methods, payment-methods, languages, translations, plugins, and more.`,
        input_schema: {
          type: 'object',
          properties: {
            entity: {
              type: 'string',
              description: 'Entity type to query (e.g., products, categories, orders, customers)'
            },
            filters: {
              type: 'object',
              description: 'Filter criteria (e.g., { status: "active", category_id: 123 })'
            },
            search: {
              type: 'string',
              description: 'Search term to find matching records'
            },
            page: {
              type: 'number',
              description: 'Page number for pagination (default: 1)'
            },
            limit: {
              type: 'number',
              description: 'Number of records per page (default: 20)'
            },
            sort: {
              type: 'string',
              description: 'Sort field and direction (e.g., "created_at:desc")'
            }
          },
          required: ['entity']
        }
      },

      // 3. GET SINGLE RECORD
      {
        name: 'get_record',
        description: 'Get a single record by ID from any entity.',
        input_schema: {
          type: 'object',
          properties: {
            entity: {
              type: 'string',
              description: 'Entity type (e.g., products, categories, orders)'
            },
            id: {
              type: 'string',
              description: 'Record ID to fetch'
            },
            include: {
              type: 'array',
              items: { type: 'string' },
              description: 'Related data to include (e.g., ["images", "categories"])'
            }
          },
          required: ['entity', 'id']
        }
      },

      // 4. CREATE RECORD
      {
        name: 'create_record',
        description: `Create a new record in any entity.
Examples: create product, category, coupon, CMS page, customer, etc.`,
        input_schema: {
          type: 'object',
          properties: {
            entity: {
              type: 'string',
              description: 'Entity type to create (e.g., products, categories, coupons)'
            },
            data: {
              type: 'object',
              description: 'Record data to create'
            }
          },
          required: ['entity', 'data']
        }
      },

      // 5. UPDATE RECORD
      {
        name: 'update_record',
        description: `Update an existing record. Use for modifying products, categories, orders, settings, etc.
For partial updates, only include the fields you want to change.`,
        input_schema: {
          type: 'object',
          properties: {
            entity: {
              type: 'string',
              description: 'Entity type to update'
            },
            id: {
              type: 'string',
              description: 'Record ID to update'
            },
            data: {
              type: 'object',
              description: 'Fields to update'
            }
          },
          required: ['entity', 'id', 'data']
        }
      },

      // 6. DELETE RECORD
      {
        name: 'delete_record',
        description: 'Delete a record. Use with caution - this is destructive.',
        input_schema: {
          type: 'object',
          properties: {
            entity: {
              type: 'string',
              description: 'Entity type'
            },
            id: {
              type: 'string',
              description: 'Record ID to delete'
            }
          },
          required: ['entity', 'id']
        }
      },

      // 7. BULK OPERATIONS
      {
        name: 'bulk_operation',
        description: 'Perform bulk operations on multiple records (update, delete, activate, deactivate).',
        input_schema: {
          type: 'object',
          properties: {
            entity: {
              type: 'string',
              description: 'Entity type'
            },
            operation: {
              type: 'string',
              enum: ['update', 'delete', 'activate', 'deactivate'],
              description: 'Bulk operation to perform'
            },
            ids: {
              type: 'array',
              items: { type: 'string' },
              description: 'Array of record IDs to operate on'
            },
            data: {
              type: 'object',
              description: 'Data for bulk update operation'
            }
          },
          required: ['entity', 'operation', 'ids']
        }
      },

      // 8. SLOT/LAYOUT CONFIGURATION - WORKS DIRECTLY WITH slot_configurations TABLE
      {
        name: 'configure_layout',
        description: `Configure page layouts and slots. Writes directly to slot_configurations table.
Use for:
- Adding mega menus, banners, navigation elements to header
- Changing slot order on product/category/cart/checkout pages
- Adding/removing content slots (text, images, buttons, containers)
- Updating slot content, styling, or position

IMPORTANT: This modifies the slot_configurations table directly. Changes are saved as draft.`,
        input_schema: {
          type: 'object',
          properties: {
            pageType: {
              type: 'string',
              enum: ['product', 'category', 'cart', 'checkout', 'success', 'header', 'footer', 'homepage'],
              description: 'Page type to configure (header for mega menus/navigation)'
            },
            operation: {
              type: 'string',
              enum: ['get', 'update', 'add_slot', 'remove_slot', 'reorder_slots', 'update_slot'],
              description: 'Layout operation to perform'
            },
            slotId: {
              type: 'string',
              description: 'Slot ID for update/remove operations'
            },
            slotType: {
              type: 'string',
              enum: ['container', 'text', 'html', 'image', 'button', 'mega-menu', 'navigation', 'banner', 'product-grid', 'category-list'],
              description: 'Type of slot to add (for add_slot operation)'
            },
            config: {
              type: 'object',
              description: 'Slot configuration with positioning and content options',
              properties: {
                label: { type: 'string', description: 'Display label for the slot' },
                content: { type: 'string', description: 'Text/HTML content for text/html slots' },
                colSpan: {
                  description: 'Grid width (1-12). Can be: number (6), or responsive object { default: 12, md: 6, lg: 4 }',
                  oneOf: [{ type: 'number' }, { type: 'object' }]
                },
                layout: {
                  type: 'object',
                  description: 'Container layout: { display: "flex"|"grid", direction: "row"|"column", gap: number, cols: number }'
                },
                styles: { type: 'object', description: 'CSS styles: { color, backgroundColor, padding, margin, etc. }' },
                position: { type: 'string', enum: ['top', 'bottom'], description: 'Where to add in rootSlots array' },
                categories: { type: 'array', description: 'Category IDs for mega-menu slots' },
                columns: { type: 'number', description: 'Number of columns for mega-menu (default: 4)' },
                showImages: { type: 'boolean', description: 'Show category images in mega-menu' },
                children: { type: 'array', description: 'Child slot IDs for container slots' },
                order: { type: 'array', description: 'Order of child elements within slot' }
              }
            }
          },
          required: ['pageType', 'operation']
        }
      },

      // 9. STYLING/THEME
      {
        name: 'update_styling',
        description: `Update visual styling and theme settings. Use for:
- Changing colors (primary, secondary, background, text)
- Updating fonts
- Modifying element-specific styles (product title, buttons, etc.)
- Theme configuration`,
        input_schema: {
          type: 'object',
          properties: {
            target: {
              type: 'string',
              description: 'What to style: "theme" for global, or specific element like "product-title", "add-to-cart-button", "header"'
            },
            styles: {
              type: 'object',
              description: 'CSS properties to apply (e.g., { color: "green", fontSize: "18px" })'
            },
            pageType: {
              type: 'string',
              description: 'Limit styling to specific page type (optional)'
            }
          },
          required: ['target', 'styles']
        }
      },

      // 10. SEARCH ACROSS ENTITIES
      {
        name: 'search',
        description: 'Search across multiple entities at once. Useful for finding related data.',
        input_schema: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'Search query'
            },
            entities: {
              type: 'array',
              items: { type: 'string' },
              description: 'Entities to search in (e.g., ["products", "categories", "orders"])'
            },
            limit: {
              type: 'number',
              description: 'Max results per entity'
            }
          },
          required: ['query']
        }
      },

      // 11. GET STORE INFO/STATS
      {
        name: 'get_store_info',
        description: 'Get store information, statistics, or configuration.',
        input_schema: {
          type: 'object',
          properties: {
            type: {
              type: 'string',
              enum: ['stats', 'config', 'settings', 'languages', 'currencies', 'integrations'],
              description: 'Type of information to retrieve'
            },
            period: {
              type: 'string',
              description: 'Time period for stats (today, week, month, year)'
            }
          },
          required: ['type']
        }
      },

      // 12. EXECUTE WORKFLOW
      {
        name: 'execute_workflow',
        description: `Execute predefined workflows or multi-step operations:
- translate_store: Translate content to languages
- optimize_images: Optimize product/category images
- generate_seo: Generate SEO metadata
- sync_inventory: Sync inventory with external source
- publish_changes: Publish draft changes`,
        input_schema: {
          type: 'object',
          properties: {
            workflow: {
              type: 'string',
              enum: ['translate_store', 'optimize_images', 'generate_seo', 'sync_inventory', 'publish_changes', 'backup_data'],
              description: 'Workflow to execute'
            },
            params: {
              type: 'object',
              description: 'Workflow parameters'
            }
          },
          required: ['workflow']
        }
      }
    ];
  }

  /**
   * Execute a tool
   * @param {string} toolName - Name of the tool
   * @param {Object} input - Tool input parameters
   * @param {Object} context - Execution context (storeId, userId, authToken)
   */
  async executeTool(toolName, input, context) {
    console.log(`🔧 Executing generic tool: ${toolName}`);
    console.log(`   Input:`, JSON.stringify(input, null, 2));

    try {
      switch (toolName) {
        case 'call_api':
          return await this._executeCallApi(input, context);

        case 'list_data':
          return await this._executeListData(input, context);

        case 'get_record':
          return await this._executeGetRecord(input, context);

        case 'create_record':
          return await this._executeCreateRecord(input, context);

        case 'update_record':
          return await this._executeUpdateRecord(input, context);

        case 'delete_record':
          return await this._executeDeleteRecord(input, context);

        case 'bulk_operation':
          return await this._executeBulkOperation(input, context);

        case 'configure_layout':
          return await this._executeConfigureLayout(input, context);

        case 'update_styling':
          return await this._executeUpdateStyling(input, context);

        case 'search':
          return await this._executeSearch(input, context);

        case 'get_store_info':
          return await this._executeGetStoreInfo(input, context);

        case 'execute_workflow':
          return await this._executeWorkflow(input, context);

        default:
          return { success: false, error: `Unknown tool: ${toolName}` };
      }
    } catch (error) {
      console.error(`❌ Tool execution error (${toolName}):`, error.message);
      return {
        success: false,
        error: error.message,
        details: error.response?.data || null
      };
    }
  }

  // ============================================
  // TOOL IMPLEMENTATIONS
  // ============================================

  /**
   * Generic API caller - can call any endpoint
   */
  async _executeCallApi({ method, endpoint, data, params }, context) {
    const response = await this._makeRequest(method, endpoint, data, params, context);
    return {
      success: true,
      data: response.data,
      status: response.status
    };
  }

  /**
   * List/query data from an entity
   */
  async _executeListData({ entity, filters, search, page, limit, sort }, context) {
    const endpoint = this._getEntityEndpoint(entity);
    const params = {
      ...filters,
      ...(search && { search }),
      ...(page && { page }),
      ...(limit && { limit }),
      ...(sort && { sort })
    };

    const response = await this._makeRequest('GET', endpoint, null, params, context);

    return {
      success: true,
      entity,
      data: response.data?.data || response.data,
      pagination: response.data?.pagination || null,
      count: Array.isArray(response.data?.data) ? response.data.data.length :
             Array.isArray(response.data) ? response.data.length : 1
    };
  }

  /**
   * Get a single record by ID
   */
  async _executeGetRecord({ entity, id, include }, context) {
    const endpoint = `${this._getEntityEndpoint(entity)}/${id}`;
    const params = include ? { include: include.join(',') } : {};

    const response = await this._makeRequest('GET', endpoint, null, params, context);

    return {
      success: true,
      entity,
      data: response.data?.data || response.data
    };
  }

  /**
   * Create a new record
   */
  async _executeCreateRecord({ entity, data }, context) {
    const endpoint = this._getEntityEndpoint(entity);
    const response = await this._makeRequest('POST', endpoint, data, null, context);

    return {
      success: true,
      entity,
      created: response.data?.data || response.data,
      message: `Created new ${entity.replace(/-/g, ' ')}`
    };
  }

  /**
   * Update an existing record
   */
  async _executeUpdateRecord({ entity, id, data }, context) {
    const endpoint = `${this._getEntityEndpoint(entity)}/${id}`;
    const response = await this._makeRequest('PUT', endpoint, data, null, context);

    return {
      success: true,
      entity,
      updated: response.data?.data || response.data,
      message: `Updated ${entity.replace(/-/g, ' ')} ${id}`
    };
  }

  /**
   * Delete a record
   */
  async _executeDeleteRecord({ entity, id }, context) {
    const endpoint = `${this._getEntityEndpoint(entity)}/${id}`;
    await this._makeRequest('DELETE', endpoint, null, null, context);

    return {
      success: true,
      entity,
      deleted: id,
      message: `Deleted ${entity.replace(/-/g, ' ')} ${id}`
    };
  }

  /**
   * Bulk operations
   */
  async _executeBulkOperation({ entity, operation, ids, data }, context) {
    const endpoint = `${this._getEntityEndpoint(entity)}/bulk`;
    const requestData = {
      operation,
      ids,
      ...(data && { data })
    };

    const response = await this._makeRequest('POST', endpoint, requestData, null, context);

    return {
      success: true,
      entity,
      operation,
      affected: ids.length,
      result: response.data
    };
  }

  /**
   * Configure page layouts and slots - WORKS DIRECTLY WITH DATABASE
   */
  async _executeConfigureLayout({ pageType, operation, slotId, slotType, config }, context) {
    const { storeId, userId } = context;
    const tenantDb = await ConnectionManager.getStoreConnection(storeId);

    switch (operation) {
      case 'get': {
        // Get current layout configuration
        const { data, error } = await tenantDb
          .from('slot_configurations')
          .select('*')
          .eq('store_id', storeId)
          .eq('page_type', pageType)
          .in('status', ['draft', 'published'])
          .order('version_number', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (error) throw error;

        return {
          success: true,
          pageType,
          operation: 'get',
          data: data?.configuration || null,
          message: data ? `Retrieved ${pageType} layout` : `No layout found for ${pageType}`
        };
      }

      case 'add_slot': {
        // Get current draft configuration
        const { data: current, error: fetchError } = await tenantDb
          .from('slot_configurations')
          .select('*')
          .eq('store_id', storeId)
          .eq('page_type', pageType)
          .in('status', ['draft', 'published'])
          .order('version_number', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (fetchError) throw fetchError;

        if (!current) {
          return {
            success: false,
            error: `No configuration found for ${pageType}. Initialize the page first.`
          };
        }

        // Parse existing configuration
        const existingConfig = current.configuration || { slots: {}, rootSlots: [] };
        const newSlotId = slotId || `slot_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;

        // Create new slot definition with proper structure
        const newSlot = {
          id: newSlotId,
          type: slotType || config?.type || 'container',
          label: config?.label || `New ${slotType || 'Slot'}`,
          content: config?.content || '',
          // Grid positioning - colSpan determines width (1-12 grid system)
          // Can be: number (6), string ('col-span-6'), or responsive object ({ default: 12, md: 6 })
          colSpan: config?.colSpan || 12,
          // Container layout options
          layout: config?.layout || (slotType === 'container' ? { display: 'flex', direction: 'row', gap: 4 } : undefined),
          // Child slot ordering (for containers)
          children: config?.children || [],
          order: config?.order || [],
          // Visual styles
          styles: config?.styles || {},
          // Additional properties based on slot type
          ...(slotType === 'mega-menu' && {
            categories: config?.categories || [],
            showImages: config?.showImages !== false,
            columns: config?.columns || 4
          }),
          ...(slotType === 'navigation' && {
            items: config?.items || [],
            orientation: config?.orientation || 'horizontal'
          }),
          ...(slotType === 'banner' && {
            imageUrl: config?.imageUrl || '',
            linkUrl: config?.linkUrl || '',
            altText: config?.altText || ''
          }),
          ...config
        };

        // Add to slots object
        existingConfig.slots = existingConfig.slots || {};
        existingConfig.slots[newSlotId] = newSlot;

        // Add to rootSlots if it's a top-level slot
        if (config?.isRoot !== false) {
          existingConfig.rootSlots = existingConfig.rootSlots || [];
          if (config?.position === 'top') {
            existingConfig.rootSlots.unshift(newSlotId);
          } else {
            existingConfig.rootSlots.push(newSlotId);
          }
        }

        // Update the configuration
        const { error: updateError } = await tenantDb
          .from('slot_configurations')
          .update({
            configuration: existingConfig,
            has_unpublished_changes: true,
            updated_at: new Date().toISOString()
          })
          .eq('id', current.id);

        if (updateError) throw updateError;

        return {
          success: true,
          pageType,
          operation: 'add_slot',
          slotId: newSlotId,
          message: `Added ${slotType || 'slot'} "${newSlot.label}" to ${pageType} page`
        };
      }

      case 'update_slot': {
        // Get current configuration
        const { data: current, error: fetchError } = await tenantDb
          .from('slot_configurations')
          .select('*')
          .eq('store_id', storeId)
          .eq('page_type', pageType)
          .in('status', ['draft', 'published'])
          .order('version_number', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (fetchError) throw fetchError;
        if (!current) {
          return { success: false, error: `No configuration found for ${pageType}` };
        }

        const existingConfig = current.configuration || { slots: {} };

        if (!existingConfig.slots?.[slotId]) {
          return { success: false, error: `Slot ${slotId} not found in ${pageType}` };
        }

        // Merge updates into existing slot
        existingConfig.slots[slotId] = {
          ...existingConfig.slots[slotId],
          ...config,
          styles: {
            ...(existingConfig.slots[slotId].styles || {}),
            ...(config?.styles || {})
          }
        };

        // Update
        const { error: updateError } = await tenantDb
          .from('slot_configurations')
          .update({
            configuration: existingConfig,
            has_unpublished_changes: true,
            updated_at: new Date().toISOString()
          })
          .eq('id', current.id);

        if (updateError) throw updateError;

        return {
          success: true,
          pageType,
          operation: 'update_slot',
          slotId,
          message: `Updated slot ${slotId} in ${pageType} page`
        };
      }

      case 'remove_slot': {
        const { data: current, error: fetchError } = await tenantDb
          .from('slot_configurations')
          .select('*')
          .eq('store_id', storeId)
          .eq('page_type', pageType)
          .in('status', ['draft', 'published'])
          .order('version_number', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (fetchError) throw fetchError;
        if (!current) {
          return { success: false, error: `No configuration found for ${pageType}` };
        }

        const existingConfig = current.configuration || { slots: {}, rootSlots: [] };

        // Remove from slots
        delete existingConfig.slots[slotId];

        // Remove from rootSlots
        existingConfig.rootSlots = (existingConfig.rootSlots || []).filter(id => id !== slotId);

        // Update
        const { error: updateError } = await tenantDb
          .from('slot_configurations')
          .update({
            configuration: existingConfig,
            has_unpublished_changes: true,
            updated_at: new Date().toISOString()
          })
          .eq('id', current.id);

        if (updateError) throw updateError;

        return {
          success: true,
          pageType,
          operation: 'remove_slot',
          slotId,
          message: `Removed slot ${slotId} from ${pageType} page`
        };
      }

      case 'reorder_slots': {
        const { data: current, error: fetchError } = await tenantDb
          .from('slot_configurations')
          .select('*')
          .eq('store_id', storeId)
          .eq('page_type', pageType)
          .in('status', ['draft', 'published'])
          .order('version_number', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (fetchError) throw fetchError;
        if (!current) {
          return { success: false, error: `No configuration found for ${pageType}` };
        }

        const existingConfig = current.configuration || {};

        // Update rootSlots order
        if (config?.rootSlots) {
          existingConfig.rootSlots = config.rootSlots;
        }

        const { error: updateError } = await tenantDb
          .from('slot_configurations')
          .update({
            configuration: existingConfig,
            has_unpublished_changes: true,
            updated_at: new Date().toISOString()
          })
          .eq('id', current.id);

        if (updateError) throw updateError;

        return {
          success: true,
          pageType,
          operation: 'reorder_slots',
          message: `Reordered slots in ${pageType} page`
        };
      }

      default:
        return { success: false, error: `Unknown operation: ${operation}` };
    }
  }

  /**
   * Update styling/theme - WORKS DIRECTLY WITH DATABASE
   */
  async _executeUpdateStyling({ target, styles, pageType }, context) {
    const { storeId } = context;
    const tenantDb = await ConnectionManager.getStoreConnection(storeId);

    // Get current configuration for the page type
    const targetPage = pageType || 'product'; // Default to product page

    const { data: current, error: fetchError } = await tenantDb
      .from('slot_configurations')
      .select('*')
      .eq('store_id', storeId)
      .eq('page_type', targetPage)
      .in('status', ['draft', 'published'])
      .order('version_number', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (fetchError) throw fetchError;

    if (!current) {
      return {
        success: false,
        error: `No configuration found for ${targetPage}. Initialize the page first.`
      };
    }

    const existingConfig = current.configuration || { slots: {}, globalStyles: {} };

    // Convert camelCase styles to CSS format
    const cssStyles = {};
    for (const [key, value] of Object.entries(styles)) {
      const cssKey = key.replace(/([A-Z])/g, '-$1').toLowerCase();
      cssStyles[cssKey] = value;
    }

    if (target === 'theme' || target === 'global') {
      // Update global styles
      existingConfig.globalStyles = {
        ...(existingConfig.globalStyles || {}),
        ...cssStyles
      };
    } else {
      // Find slot by type/name and update its styles
      const slotId = this._findSlotByTarget(existingConfig.slots, target);

      if (slotId && existingConfig.slots[slotId]) {
        existingConfig.slots[slotId].styles = {
          ...(existingConfig.slots[slotId].styles || {}),
          ...cssStyles
        };
      } else {
        // Store as element-specific override
        existingConfig.elementStyles = existingConfig.elementStyles || {};
        existingConfig.elementStyles[target] = {
          ...(existingConfig.elementStyles[target] || {}),
          ...cssStyles
        };
      }
    }

    // Update the configuration
    const { error: updateError } = await tenantDb
      .from('slot_configurations')
      .update({
        configuration: existingConfig,
        has_unpublished_changes: true,
        updated_at: new Date().toISOString()
      })
      .eq('id', current.id);

    if (updateError) throw updateError;

    return {
      success: true,
      target,
      styles: cssStyles,
      pageType: targetPage,
      message: `Updated ${target} styling on ${targetPage} page`
    };
  }

  /**
   * Helper: Find slot ID by target name (e.g., "product-title", "add-to-cart")
   */
  _findSlotByTarget(slots, target) {
    if (!slots) return null;

    // Direct match
    if (slots[target]) return target;

    // Search by type or label
    for (const [slotId, slot] of Object.entries(slots)) {
      if (slot.type === target || slot.label?.toLowerCase().includes(target.toLowerCase())) {
        return slotId;
      }
    }

    return null;
  }

  /**
   * Search across entities
   */
  async _executeSearch({ query, entities, limit = 10 }, context) {
    const searchEntities = entities || ['products', 'categories', 'orders', 'customers'];
    const results = {};

    for (const entity of searchEntities) {
      try {
        const endpoint = this._getEntityEndpoint(entity);
        const response = await this._makeRequest('GET', endpoint, null, {
          search: query,
          limit
        }, context);

        results[entity] = response.data?.data || response.data || [];
      } catch (error) {
        results[entity] = { error: error.message };
      }
    }

    return {
      success: true,
      query,
      results
    };
  }

  /**
   * Get store info/stats
   */
  async _executeGetStoreInfo({ type, period }, context) {
    let endpoint;
    let params = {};

    switch (type) {
      case 'stats':
        endpoint = '/api/analytics/dashboard';
        if (period) params.period = period;
        break;
      case 'config':
        endpoint = '/api/stores/current';
        break;
      case 'settings':
        endpoint = '/api/settings';
        break;
      case 'languages':
        endpoint = '/api/languages';
        break;
      case 'currencies':
        endpoint = '/api/currencies';
        break;
      case 'integrations':
        endpoint = '/api/integrations';
        break;
      default:
        endpoint = '/api/stores/current';
    }

    const response = await this._makeRequest('GET', endpoint, null, params, context);

    return {
      success: true,
      type,
      data: response.data?.data || response.data
    };
  }

  /**
   * Execute predefined workflows
   */
  async _executeWorkflow({ workflow, params = {} }, context) {
    let endpoint;
    let method = 'POST';
    let data = params;

    switch (workflow) {
      case 'translate_store':
        endpoint = '/api/translations/bulk-translate';
        break;
      case 'optimize_images':
        endpoint = '/api/image-optimization/bulk';
        break;
      case 'generate_seo':
        endpoint = '/api/seo-settings/generate';
        break;
      case 'sync_inventory':
        endpoint = '/api/integrations/sync-inventory';
        break;
      case 'publish_changes':
        endpoint = '/api/storefronts/publish';
        break;
      case 'backup_data':
        endpoint = '/api/backups/create';
        break;
      default:
        return { success: false, error: `Unknown workflow: ${workflow}` };
    }

    const response = await this._makeRequest(method, endpoint, data, null, context);

    return {
      success: true,
      workflow,
      result: response.data,
      message: `Workflow ${workflow} completed`
    };
  }

  // ============================================
  // HELPER METHODS
  // ============================================

  /**
   * Get the API endpoint for an entity
   */
  _getEntityEndpoint(entity) {
    // Normalize entity name to endpoint
    const entityMap = {
      'product': '/api/products',
      'products': '/api/products',
      'category': '/api/categories',
      'categories': '/api/categories',
      'order': '/api/orders',
      'orders': '/api/orders',
      'customer': '/api/customers',
      'customers': '/api/customers',
      'coupon': '/api/coupons',
      'coupons': '/api/coupons',
      'cms-page': '/api/cms',
      'cms-pages': '/api/cms',
      'cms-block': '/api/cms-blocks',
      'cms-blocks': '/api/cms-blocks',
      'attribute': '/api/attributes',
      'attributes': '/api/attributes',
      'attribute-set': '/api/attribute-sets',
      'attribute-sets': '/api/attribute-sets',
      'shipping': '/api/shipping',
      'shipping-method': '/api/shipping',
      'shipping-methods': '/api/shipping',
      'payment-method': '/api/payment-methods',
      'payment-methods': '/api/payment-methods',
      'language': '/api/languages',
      'languages': '/api/languages',
      'translation': '/api/translations',
      'translations': '/api/translations',
      'plugin': '/api/plugins',
      'plugins': '/api/plugins',
      'user': '/api/users',
      'users': '/api/users',
      'redirect': '/api/redirects',
      'redirects': '/api/redirects',
      'seo-template': '/api/seo-templates',
      'seo-templates': '/api/seo-templates',
      'email-template': '/api/email-templates',
      'email-templates': '/api/email-templates',
      'campaign': '/api/campaigns',
      'campaigns': '/api/campaigns',
      'segment': '/api/segments',
      'segments': '/api/segments',
      'automation': '/api/automations',
      'automations': '/api/automations',
      'slot-configuration': '/api/slot-configurations',
      'slot-configurations': '/api/slot-configurations',
      'theme': '/api/theme-defaults',
      'themes': '/api/theme-defaults',
      'storefront': '/api/storefronts',
      'storefronts': '/api/storefronts'
    };

    return entityMap[entity.toLowerCase()] || `/api/${entity}`;
  }

  /**
   * Make an HTTP request to the API
   */
  async _makeRequest(method, endpoint, data, params, context) {
    const { storeId, authToken } = context;

    const config = {
      method,
      url: `${this.baseUrl}${endpoint}`,
      headers: {
        'Content-Type': 'application/json',
        'X-Store-Id': storeId,
        ...(authToken && { 'Authorization': `Bearer ${authToken}` })
      },
      ...(data && { data }),
      ...(params && { params })
    };

    console.log(`   📡 ${method} ${endpoint}`);

    const response = await axios(config);

    console.log(`   ✅ Response: ${response.status}`);

    return response;
  }

  /**
   * Get the system prompt for the AI
   * This teaches the AI about available tools and how to use them
   */
  getSystemPrompt() {
    return `You are an AI assistant for managing an e-commerce store. You can perform ANY operation on the store through the available tools.

## YOUR CAPABILITIES

You have access to tools that can:
- **Read data**: List products, categories, orders, customers, and any other entity
- **Create records**: Add new products, categories, coupons, CMS pages, etc.
- **Update records**: Modify any existing data including prices, descriptions, settings
- **Delete records**: Remove products, categories, or other records
- **Configure layouts**: Change page layouts, slot ordering, add/remove sections
- **Update styling**: Change colors, fonts, spacing, and other visual properties
- **Execute workflows**: Bulk translate, optimize images, generate SEO, etc.

## HOW TO USE TOOLS

1. **For simple queries** (list, get, search):
   - Use \`list_data\` to query entities with filters
   - Use \`get_record\` to fetch a specific record by ID
   - Use \`search\` to find data across multiple entities

2. **For modifications**:
   - Use \`create_record\` to add new records
   - Use \`update_record\` to modify existing records
   - Use \`delete_record\` to remove records (ask for confirmation first!)
   - Use \`bulk_operation\` for batch updates

3. **For layout/design changes**:
   - Use \`configure_layout\` to modify page structure and slots
   - Use \`update_styling\` to change visual appearance

4. **For complex operations**:
   - Use \`execute_workflow\` for multi-step processes
   - Use \`call_api\` for any endpoint not covered by other tools

## IMPORTANT GUIDELINES

1. **Always confirm destructive operations** (delete, bulk delete) before executing
2. **Be specific** about what you're changing and why
3. **Show results** after making changes so users can verify
4. **Handle errors gracefully** and explain what went wrong
5. **For styling**, use CSS property names (color, fontSize, backgroundColor, etc.)

## AVAILABLE ENTITIES

Products, Categories, Orders, Customers, Coupons, CMS Pages, CMS Blocks,
Attributes, Attribute Sets, Shipping Methods, Payment Methods, Languages,
Translations, Plugins, Extensions, Email Templates, SEO Templates,
Campaigns, Segments, Automations, Redirects, Slot Configurations,
Theme Settings, Storefronts, and more.

## EXAMPLES

User: "Show me all products under $50"
→ Use list_data with entity="products" and filters={price_lt: 50}

User: "Change the product title color to green"
→ Use update_styling with target="product-title" and styles={color: "green"}

User: "Add a banner to the homepage"
→ Use configure_layout with pageType="homepage", operation="add_slot", config={type: "banner", ...}

User: "Create a 20% off coupon"
→ Use create_record with entity="coupons" and data={code: "SAVE20", discount_type: "percentage", discount_value: 20}

Always be helpful and proactive. If you need more information to complete a task, ask the user.`;
  }
}

module.exports = new GenericApiToolService();
