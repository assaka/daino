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
      // ============================================
      // EXPLORATION TOOLS (Claude Code-like)
      // ============================================

      // LEARN/TRAIN - Auto-populate AI tables from discoveries
      {
        name: 'learn',
        description: `Auto-train AI knowledge by saving discoveries to AI tables.
Call this after exploring to save what you learned for future use.

Use cases:
- After explore_schema finds a table not in ai_entity_definitions → learn it
- After discovering a new pattern → save to ai_code_patterns
- After successful interaction → save to ai_learning_insights

This makes the AI smarter over time without manual data entry.`,
        input_schema: {
          type: 'object',
          properties: {
            type: {
              type: 'string',
              enum: ['entity', 'pattern', 'context', 'insight'],
              description: 'What to learn: entity (table schema), pattern (code pattern), context (documentation), insight (successful interaction)'
            },
            data: {
              type: 'object',
              description: 'The knowledge to save - structure depends on type'
            },
            source: {
              type: 'string',
              description: 'Where this knowledge came from (e.g., "exploration", "user_request", "successful_operation")'
            }
          },
          required: ['type', 'data']
        }
      },

      // EXPLORE SCHEMA - Discover database structure
      {
        name: 'explore_schema',
        description: `Discover database tables and their columns. Use this FIRST when you need to understand where data is stored.
Like exploring a codebase - discover before acting.

AUTO-LEARNING: When gaps are found, automatically saves discoveries to AI tables.

Examples:
- "Where is the store logo stored?" → explore_schema to find logo-related columns
- "How do slots work?" → explore_schema for slot_configurations table
- "What fields does a product have?" → explore_schema for products table`,
        input_schema: {
          type: 'object',
          properties: {
            table: {
              type: 'string',
              description: 'Specific table to explore (e.g., "stores", "products", "slot_configurations", "plugin_registry"). Leave empty to list all tables.'
            },
            search: {
              type: 'string',
              description: 'Search term to find relevant tables/columns (e.g., "logo", "image", "slot", "menu")'
            }
          }
        }
      },

      // QUERY DATABASE - Read any data directly
      {
        name: 'query_database',
        description: `Query any database table directly. Like reading files in a codebase.
Use after explore_schema to understand the data.

Examples:
- Read current store settings
- See existing slot configurations
- Check what plugins are registered
- Find where a specific value is stored`,
        input_schema: {
          type: 'object',
          properties: {
            table: {
              type: 'string',
              description: 'Table to query (e.g., "stores", "slot_configurations", "plugin_registry")'
            },
            select: {
              type: 'string',
              description: 'Columns to select (comma-separated, or "*" for all)'
            },
            filters: {
              type: 'object',
              description: 'Filter conditions as key-value pairs (e.g., { "store_id": "uuid", "status": "active" })'
            },
            limit: {
              type: 'number',
              description: 'Max rows to return (default: 10)'
            },
            single: {
              type: 'boolean',
              description: 'Return single record instead of array'
            }
          },
          required: ['table']
        }
      },

      // DISCOVER COMPONENTS - Find registered slot types and plugins
      {
        name: 'discover_components',
        description: `Discover what UI components, slot types, and plugins are available.
Use this to understand what can be rendered before trying to add it.

Returns:
- Registered slot types (from plugin_registry)
- Built-in slot types (text, button, image, container, etc.)
- Custom components created by the store`,
        input_schema: {
          type: 'object',
          properties: {
            type: {
              type: 'string',
              enum: ['all', 'slot_types', 'plugins', 'custom'],
              description: 'What to discover (default: all)'
            },
            search: {
              type: 'string',
              description: 'Search for specific component (e.g., "mega", "menu", "banner")'
            }
          }
        }
      },

      // READ COMPONENT DEFINITION - Understand how a component works
      {
        name: 'read_component',
        description: `Read the definition of a specific component or plugin to understand its structure.
Like reading source code - understand how it works before using or creating similar.

Returns the component's:
- Configuration schema
- Render template
- Required props
- Example usage`,
        input_schema: {
          type: 'object',
          properties: {
            componentId: {
              type: 'string',
              description: 'Component ID or name to read (e.g., "mega-menu", "product-grid")'
            },
            type: {
              type: 'string',
              enum: ['plugin', 'slot_type', 'any'],
              description: 'Type of component to look for (default: any)'
            }
          },
          required: ['componentId']
        }
      },

      // CREATE COMPONENT - Create new slot type as plugin
      {
        name: 'create_component',
        description: `Create a new UI component/slot type as a plugin.
Use when a requested component doesn't exist (e.g., "mega-menu").

The component is stored in plugin_registry and can be rendered dynamically.
Guide the user through:
1. What the component should look like
2. What data it needs
3. How it should behave`,
        input_schema: {
          type: 'object',
          properties: {
            name: {
              type: 'string',
              description: 'Component name (e.g., "mega-menu", "testimonial-carousel")'
            },
            type: {
              type: 'string',
              enum: ['slot_type', 'widget', 'block'],
              description: 'Component type (default: slot_type)'
            },
            definition: {
              type: 'object',
              description: 'Component definition',
              properties: {
                label: { type: 'string', description: 'Display name' },
                description: { type: 'string', description: 'What this component does' },
                category: { type: 'string', description: 'Category: navigation, content, marketing, layout' },
                icon: { type: 'string', description: 'Icon name (optional)' },
                props: {
                  type: 'object',
                  description: 'Configurable properties with types and defaults'
                },
                template: {
                  type: 'object',
                  description: 'Render template using primitives (container, text, image, link, foreach)'
                },
                dataSource: {
                  type: 'object',
                  description: 'Where to fetch data from (e.g., { entity: "categories", filters: {} })'
                },
                defaultStyles: {
                  type: 'object',
                  description: 'Default CSS styles'
                }
              }
            }
          },
          required: ['name', 'definition']
        }
      },

      // GET AI CONTEXT - Retrieve architecture docs and knowledge
      {
        name: 'get_ai_context',
        description: `Get architecture documentation and knowledge from the AI knowledge base.
Use this to understand how systems work before making changes.

Available types:
- architecture: System design docs, how components connect
- api_reference: API endpoints and usage
- best_practices: Recommended patterns
- tutorial: Step-by-step guides

Categories: core, products, settings, content, marketing, translations, slots`,
        input_schema: {
          type: 'object',
          properties: {
            type: {
              type: 'string',
              enum: ['architecture', 'api_reference', 'best_practices', 'tutorial', 'reference'],
              description: 'Type of context to retrieve'
            },
            category: {
              type: 'string',
              description: 'Category filter (e.g., "slots", "products", "settings")'
            },
            search: {
              type: 'string',
              description: 'Search term to find relevant documentation'
            },
            limit: {
              type: 'number',
              description: 'Max documents to return (default: 5)'
            }
          }
        }
      },

      // GET SYSTEM OVERVIEW - Architecture, admin features, sidebar
      {
        name: 'get_system_overview',
        description: `Get high-level system overview: architecture, admin sidebar structure, features.
Use this to understand the overall system before diving into specifics.

Areas:
- architecture: Overall system design, tech stack, how pieces connect
- admin_sidebar: Admin navigation structure, sections, features
- admin_features: Available admin capabilities and where to find them
- slot_system: How slots/layouts work
- plugin_system: How plugins and extensions work`,
        input_schema: {
          type: 'object',
          properties: {
            area: {
              type: 'string',
              enum: ['architecture', 'admin_sidebar', 'admin_features', 'slot_system', 'plugin_system', 'all'],
              description: 'Which area to get overview of'
            }
          }
        }
      },

      // UPDATE STORE SETTING - Direct setting updates
      {
        name: 'update_store_setting',
        description: `Update a store setting directly. Use for:
- Store logo, favicon
- Store name, description
- Theme settings
- Any store-level configuration

First use explore_schema or query_database to find where the setting is stored.`,
        input_schema: {
          type: 'object',
          properties: {
            setting: {
              type: 'string',
              description: 'Setting key path (e.g., "logo_url", "settings.theme.primaryColor")'
            },
            value: {
              description: 'New value for the setting'
            },
            table: {
              type: 'string',
              description: 'Table where setting is stored (auto-detected if not provided)'
            }
          },
          required: ['setting', 'value']
        }
      },

      // ============================================
      // CRUD TOOLS (existing)
      // ============================================

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
        // ============================================
        // EXPLORATION TOOLS (Claude Code-like)
        // ============================================
        case 'learn':
          return await this._executeLearn(input, context);

        case 'explore_schema':
          return await this._executeExploreSchema(input, context);

        case 'query_database':
          return await this._executeQueryDatabase(input, context);

        case 'discover_components':
          return await this._executeDiscoverComponents(input, context);

        case 'read_component':
          return await this._executeReadComponent(input, context);

        case 'create_component':
          return await this._executeCreateComponent(input, context);

        case 'update_store_setting':
          return await this._executeUpdateStoreSetting(input, context);

        case 'get_ai_context':
          return await this._executeGetAiContext(input, context);

        case 'get_system_overview':
          return await this._executeGetSystemOverview(input, context);

        // ============================================
        // CRUD TOOLS
        // ============================================
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
  // EXPLORATION TOOL IMPLEMENTATIONS
  // ============================================

  /**
   * Auto-learn: Save discoveries to AI tables
   * Makes the AI smarter over time without manual data entry
   */
  async _executeLearn({ type, data, source = 'exploration' }, context) {
    const { masterDbClient } = require('../database/masterConnection');

    try {
      switch (type) {
        case 'entity': {
          // Learn a table schema → save to ai_entity_definitions
          const { table_name, columns, description } = data;

          // Check if already exists
          const { data: existing } = await masterDbClient
            .from('ai_entity_definitions')
            .select('id')
            .eq('table_name', table_name)
            .maybeSingle();

          if (existing) {
            // Update existing
            const { error } = await masterDbClient
              .from('ai_entity_definitions')
              .update({
                fields: columns.reduce((acc, c) => {
                  acc[c.name] = { type: c.type, description: c.description || `${c.name} field` };
                  return acc;
                }, {}),
                updated_at: new Date().toISOString()
              })
              .eq('id', existing.id);

            if (error) throw error;
            return { success: true, action: 'updated', table: table_name, message: `Updated ai_entity_definitions for ${table_name}` };
          }

          // Create new
          const { error } = await masterDbClient
            .from('ai_entity_definitions')
            .insert({
              entity_name: table_name,
              display_name: table_name.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
              description: description || `${table_name} table`,
              table_name: table_name,
              fields: columns.reduce((acc, c) => {
                acc[c.name] = { type: c.type, description: c.description || `${c.name} field` };
                return acc;
              }, {}),
              supported_operations: ['list', 'get', 'create', 'update', 'delete'],
              is_active: true,
              category: 'auto_learned',
              priority: 30,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            });

          if (error) throw error;
          return { success: true, action: 'created', table: table_name, message: `Learned ${table_name} schema → saved to ai_entity_definitions` };
        }

        case 'pattern': {
          // Learn a code pattern → save to ai_code_patterns
          const { name, pattern_type, code, description } = data;

          const { error } = await masterDbClient
            .from('ai_code_patterns')
            .upsert({
              name,
              pattern_type: pattern_type || 'ui_component',
              description: description || `${name} pattern`,
              code: typeof code === 'object' ? JSON.stringify(code) : code,
              language: 'javascript',
              is_active: true,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            }, { onConflict: 'name' });

          if (error) throw error;
          return { success: true, action: 'saved', name, message: `Learned pattern "${name}" → saved to ai_code_patterns` };
        }

        case 'context': {
          // Learn context/documentation → save to ai_context_documents
          const { title, content, category, doc_type } = data;

          const { error } = await masterDbClient
            .from('ai_context_documents')
            .insert({
              type: doc_type || 'reference',
              title,
              content,
              category: category || 'auto_learned',
              priority: 30,
              is_active: true,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            });

          if (error) throw error;
          return { success: true, action: 'created', title, message: `Learned context "${title}" → saved to ai_context_documents` };
        }

        case 'insight': {
          // Learn from successful interaction → save to ai_learning_insights
          const { pattern_description, entity, example_prompts, was_successful } = data;

          const { error } = await masterDbClient
            .from('ai_learning_insights')
            .insert({
              insight_type: was_successful ? 'successful_pattern' : 'common_failure',
              entity,
              pattern_description,
              example_prompts: example_prompts || [],
              success_count: was_successful ? 1 : 0,
              failure_count: was_successful ? 0 : 1,
              confidence_score: 0.5,
              is_applied: false,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            });

          if (error) throw error;
          return { success: true, action: 'recorded', message: `Learned insight → saved to ai_learning_insights` };
        }

        default:
          return { success: false, error: `Unknown learning type: ${type}` };
      }
    } catch (error) {
      console.error('Learning failed:', error);
      return { success: false, error: error.message, hint: 'Check AI table permissions and structure' };
    }
  }

  /**
   * Explore schema - DB is truth, AI tables are hints
   * Always explores actual DB, enriches with AI hints if available
   * AUTO-LEARNS: Saves discoveries to AI tables when gaps are found
   */
  async _executeExploreSchema({ table, search }, context) {
    const { storeId } = context;
    const tenantDb = await ConnectionManager.getStoreConnection(storeId);

    // Try to get AI hints (but don't rely on them)
    let aiHints = null;
    try {
      const { masterDbClient } = require('../database/masterConnection');
      if (table) {
        const { data } = await masterDbClient
          .from('ai_entity_definitions')
          .select('description, supported_operations, api_endpoint, example_prompts, fields')
          .or(`table_name.eq.${table},entity_name.eq.${table}`)
          .eq('is_active', true)
          .maybeSingle();
        aiHints = data;
      }
    } catch (e) {
      // AI tables not available, continue without hints
    }

    if (table) {
      // ALWAYS query actual DB - this is the source of truth
      const { data: samples, error } = await tenantDb
        .from(table)
        .select('*')
        .limit(3);

      if (error) {
        return {
          success: false,
          message: `Table "${table}" not accessible: ${error.message}`,
          hint: 'Table may not exist or you may not have permission'
        };
      }

      // Extract actual columns from DB data
      const actualColumns = samples?.[0] ? Object.keys(samples[0]).map(col => {
        const val = samples[0][col];
        return {
          name: col,
          type: val === null ? 'unknown' : typeof val === 'object' ? (Array.isArray(val) ? 'array' : 'jsonb') : typeof val,
          sample: typeof val === 'object' ? JSON.stringify(val).substring(0, 150) : String(val ?? '').substring(0, 80)
        };
      }) : [];

      // Check for gaps - columns in DB but not in AI hints
      const aiFields = aiHints?.fields ? Object.keys(aiHints.fields) : [];
      const gaps = actualColumns.filter(c => !aiFields.includes(c.name)).map(c => c.name);

      // AUTO-LEARN: If no AI hints or significant gaps, save to AI tables
      let learned = null;
      if (!aiHints || gaps.length > actualColumns.length * 0.5) {
        try {
          learned = await this._executeLearn({
            type: 'entity',
            data: {
              table_name: table,
              columns: actualColumns,
              description: `Auto-learned: ${table} table with ${actualColumns.length} columns`
            },
            source: 'auto_exploration'
          }, context);
        } catch (e) {
          // Learning failed, continue without it
          console.log('Auto-learning failed:', e.message);
        }
      }

      return {
        success: true,
        table,
        columns: actualColumns,
        sampleData: samples?.slice(0, 2),
        // AI hints (enrichment, not truth)
        hints: aiHints ? {
          description: aiHints.description,
          operations: aiHints.supported_operations,
          apiEndpoint: aiHints.api_endpoint,
          examplePrompts: aiHints.example_prompts?.slice(0, 3)
        } : null,
        // Auto-learning status
        learned: learned?.success ? {
          action: learned.action,
          message: learned.message
        } : null,
        // Flag remaining gaps
        gaps: gaps.length > 0 && !learned?.success ? {
          missingFromAiTables: gaps,
          suggestion: `These columns exist in DB but not in ai_entity_definitions: ${gaps.join(', ')}`
        } : null,
        message: `Explored ${table}: ${actualColumns.length} columns` +
          (aiHints ? ' (with AI hints)' : ' (no AI hints)') +
          (learned?.success ? ` - AUTO-LEARNED!` : '')
      };
    }

    // List tables by actually exploring DB (truth) + AI hints for descriptions
    const commonTables = [
      'stores', 'products', 'categories', 'orders', 'customers',
      'slot_configurations', 'plugin_registry', 'media_assets',
      'coupons', 'cms_pages', 'cms_blocks', 'translations',
      'storefronts', 'theme_defaults', 'attributes', 'attribute_sets',
      'shipping_methods', 'payment_methods', 'seo_settings', 'redirects'
    ];

    // Get AI hints for descriptions
    let aiEntities = {};
    try {
      const { masterDbClient } = require('../database/masterConnection');
      const { data } = await masterDbClient
        .from('ai_entity_definitions')
        .select('table_name, display_name, description, category')
        .eq('is_active', true);
      if (data) {
        data.forEach(e => { aiEntities[e.table_name] = e; });
      }
    } catch (e) { /* continue without AI hints */ }

    // Actually check which tables exist and have data
    const tables = [];
    for (const tableName of commonTables) {
      if (search && !tableName.includes(search.toLowerCase())) continue;

      const { data, error } = await tenantDb.from(tableName).select('id').limit(1);
      if (!error) {
        const aiHint = aiEntities[tableName];
        tables.push({
          name: tableName,
          hasData: data && data.length > 0,
          displayName: aiHint?.display_name || tableName.replace(/_/g, ' '),
          description: aiHint?.description || null,
          category: aiHint?.category || 'general'
        });
      }
    }

    // Group by category
    const byCategory = tables.reduce((acc, t) => {
      const cat = t.category || 'other';
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(t);
      return acc;
    }, {});

    return {
      success: true,
      tables,
      byCategory,
      tablesWithoutAiHints: tables.filter(t => !t.description).map(t => t.name),
      message: `Found ${tables.length} accessible tables`,
      hint: 'Use explore_schema with table parameter to see columns and sample data'
    };
  }

  /**
   * Query database directly - read any table
   */
  async _executeQueryDatabase({ table, select, filters, limit = 10, single }, context) {
    const { storeId } = context;
    const tenantDb = await ConnectionManager.getStoreConnection(storeId);

    let query = tenantDb.from(table);

    // Select specific columns or all
    if (select && select !== '*') {
      query = query.select(select);
    } else {
      query = query.select('*');
    }

    // Apply filters
    if (filters) {
      for (const [key, value] of Object.entries(filters)) {
        if (value === null) {
          query = query.is(key, null);
        } else if (Array.isArray(value)) {
          query = query.in(key, value);
        } else {
          query = query.eq(key, value);
        }
      }
    }

    // Auto-filter by store_id if table has it
    const storeIdTables = ['slot_configurations', 'products', 'categories', 'orders', 'customers', 'media_assets', 'plugin_registry'];
    if (storeIdTables.includes(table) && !filters?.store_id) {
      query = query.eq('store_id', storeId);
    }

    query = query.limit(limit);

    if (single) {
      const { data, error } = await query.maybeSingle();
      if (error) throw new Error(error.message);
      return { success: true, table, data, count: data ? 1 : 0 };
    }

    const { data, error } = await query;
    if (error) throw new Error(error.message);

    return {
      success: true,
      table,
      data,
      count: data?.length || 0,
      message: `Retrieved ${data?.length || 0} rows from ${table}`
    };
  }

  /**
   * Discover available components using AI tables from master DB
   * Uses: ai_code_patterns (ui_component patterns), ai_plugin_examples, plugin_registry
   */
  async _executeDiscoverComponents({ type = 'all', search }, context) {
    const { storeId } = context;
    const tenantDb = await ConnectionManager.getStoreConnection(storeId);
    const { masterDbClient } = require('../database/masterConnection');

    const result = {
      success: true,
      builtIn: [],
      custom: [],
      patterns: [],
      examples: []
    };

    // Get built-in slot types from ai_code_patterns (pattern_type = 'ui_component')
    if (type === 'all' || type === 'slot_types') {
      let patternsQuery = masterDbClient
        .from('ai_code_patterns')
        .select('name, description, code, parameters, example_usage')
        .eq('pattern_type', 'ui_component')
        .eq('is_active', true);

      if (search) {
        patternsQuery = patternsQuery.or(`name.ilike.%${search}%,description.ilike.%${search}%`);
      }

      const { data: patterns } = await patternsQuery;
      result.builtIn = patterns?.map(p => ({
        type: p.name,
        description: p.description,
        props: p.parameters,
        example: p.example_usage
      })) || [];
    }

    // Get component examples from ai_plugin_examples
    if (type === 'all' || type === 'examples') {
      let examplesQuery = masterDbClient
        .from('ai_plugin_examples')
        .select('name, slug, description, category, complexity, features')
        .eq('is_active', true)
        .limit(10);

      if (search) {
        examplesQuery = examplesQuery.or(`name.ilike.%${search}%,description.ilike.%${search}%`);
      }

      const { data: examples } = await examplesQuery;
      result.examples = examples?.map(e => ({
        name: e.name,
        slug: e.slug,
        description: e.description,
        category: e.category,
        complexity: e.complexity,
        features: e.features
      })) || [];
    }

    // Query store's custom components from plugin_registry (tenant DB)
    if (type === 'all' || type === 'custom' || type === 'plugins') {
      let query = tenantDb
        .from('plugin_registry')
        .select('id, name, type, description, configuration, status')
        .eq('store_id', storeId);

      if (search) {
        query = query.or(`name.ilike.%${search}%,description.ilike.%${search}%`);
      }

      const { data: plugins } = await query;

      if (plugins) {
        result.custom = plugins.filter(p => p.type === 'slot_type').map(p => ({
          type: p.name,
          description: p.description,
          props: Object.keys(p.configuration?.props || {}),
          pluginId: p.id,
          status: p.status
        }));

        result.patterns = plugins.filter(p => p.type !== 'slot_type').map(p => ({
          name: p.name,
          type: p.type,
          description: p.description,
          status: p.status,
          pluginId: p.id
        }));
      }
    }

    const totalFound = result.builtIn.length + result.custom.length + result.examples.length;

    return {
      ...result,
      message: `Found: ${result.builtIn.length} built-in from ai_code_patterns, ${result.custom.length} store custom, ${result.examples.length} examples from ai_plugin_examples`,
      hint: result.custom.length === 0 && search
        ? `No custom "${search}" component found. Use create_component to create one, or check ai_plugin_examples for templates.`
        : null
    };
  }

  /**
   * Read a component/plugin definition
   */
  async _executeReadComponent({ componentId, type = 'any' }, context) {
    const { storeId } = context;
    const tenantDb = await ConnectionManager.getStoreConnection(storeId);

    // Check built-in types first
    const builtInDefs = {
      'container': {
        type: 'container',
        description: 'Layout container for grouping child slots',
        props: {
          layout: { type: 'object', description: '{ display: "flex"|"grid", direction, gap, cols }' },
          children: { type: 'array', description: 'Child slot IDs' },
          colSpan: { type: 'number', description: 'Grid width 1-12' },
          styles: { type: 'object', description: 'CSS styles' }
        },
        example: { type: 'container', layout: { display: 'flex', direction: 'row', gap: 4 }, children: ['slot1', 'slot2'] }
      },
      'text': {
        type: 'text',
        description: 'Text content slot',
        props: {
          content: { type: 'string', description: 'Text content' },
          styles: { type: 'object', description: 'CSS styles (color, fontSize, fontWeight, etc.)' }
        },
        example: { type: 'text', content: 'Hello World', styles: { color: 'blue', fontSize: '16px' } }
      },
      'image': {
        type: 'image',
        description: 'Image display slot',
        props: {
          src: { type: 'string', description: 'Image URL' },
          alt: { type: 'string', description: 'Alt text' },
          styles: { type: 'object', description: 'CSS styles (width, height, objectFit, etc.)' }
        },
        example: { type: 'image', src: '/logo.png', alt: 'Store Logo', styles: { width: '200px' } }
      },
      'button': {
        type: 'button',
        description: 'Clickable button',
        props: {
          label: { type: 'string', description: 'Button text' },
          action: { type: 'object', description: '{ type: "link"|"submit"|"custom", value }' },
          variant: { type: 'string', description: 'primary|secondary|outline' },
          styles: { type: 'object', description: 'CSS styles' }
        },
        example: { type: 'button', label: 'Shop Now', action: { type: 'link', value: '/shop' } }
      },
      'link': {
        type: 'link',
        description: 'Navigation link',
        props: {
          href: { type: 'string', description: 'Link URL' },
          label: { type: 'string', description: 'Link text' },
          target: { type: 'string', description: '_self|_blank' }
        },
        example: { type: 'link', href: '/about', label: 'About Us' }
      }
    };

    if (builtInDefs[componentId]) {
      return {
        success: true,
        component: builtInDefs[componentId],
        source: 'built-in',
        message: `${componentId} is a built-in slot type`
      };
    }

    // Search in plugin_registry
    const { data: plugin } = await tenantDb
      .from('plugin_registry')
      .select('*')
      .eq('store_id', storeId)
      .or(`name.eq.${componentId},id.eq.${componentId}`)
      .maybeSingle();

    if (plugin) {
      return {
        success: true,
        component: {
          id: plugin.id,
          name: plugin.name,
          type: plugin.type,
          description: plugin.description,
          props: plugin.configuration?.props || {},
          template: plugin.configuration?.template,
          dataSource: plugin.configuration?.dataSource,
          defaultStyles: plugin.configuration?.defaultStyles,
          status: plugin.status
        },
        source: 'plugin_registry',
        message: `Found custom component: ${plugin.name}`
      };
    }

    return {
      success: false,
      message: `Component "${componentId}" not found`,
      hint: 'Use discover_components to see available components, or create_component to create a new one'
    };
  }

  /**
   * Create a new component as a plugin
   */
  async _executeCreateComponent({ name, type = 'slot_type', definition }, context) {
    const { storeId, userId } = context;
    const tenantDb = await ConnectionManager.getStoreConnection(storeId);

    // Check if component already exists
    const { data: existing } = await tenantDb
      .from('plugin_registry')
      .select('id')
      .eq('store_id', storeId)
      .eq('name', name)
      .maybeSingle();

    if (existing) {
      return {
        success: false,
        message: `Component "${name}" already exists`,
        existingId: existing.id,
        hint: 'Use update_record to modify the existing component, or choose a different name'
      };
    }

    // Create the plugin
    const pluginData = {
      store_id: storeId,
      name: name,
      type: type,
      description: definition.description || `Custom ${name} component`,
      status: 'active',
      configuration: {
        label: definition.label || name,
        category: definition.category || 'custom',
        icon: definition.icon,
        props: definition.props || {},
        template: definition.template,
        dataSource: definition.dataSource,
        defaultStyles: definition.defaultStyles || {}
      },
      created_by: userId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const { data: created, error } = await tenantDb
      .from('plugin_registry')
      .insert(pluginData)
      .select()
      .single();

    if (error) throw new Error(error.message);

    return {
      success: true,
      component: {
        id: created.id,
        name: created.name,
        type: created.type,
        ...created.configuration
      },
      message: `Created "${name}" component. You can now use it in configure_layout with slotType="${name}"`,
      usage: {
        tool: 'configure_layout',
        example: {
          pageType: 'header',
          operation: 'add_slot',
          slotType: name,
          config: { ...definition.defaultStyles }
        }
      }
    };
  }

  /**
   * Update a store setting directly
   */
  async _executeUpdateStoreSetting({ setting, value, table }, context) {
    const { storeId } = context;
    const tenantDb = await ConnectionManager.getStoreConnection(storeId);

    // Map common setting names to table.column
    const settingMap = {
      'logo': { table: 'stores', column: 'logo_url' },
      'logo_url': { table: 'stores', column: 'logo_url' },
      'store_logo': { table: 'stores', column: 'logo_url' },
      'favicon': { table: 'stores', column: 'favicon_url' },
      'favicon_url': { table: 'stores', column: 'favicon_url' },
      'store_name': { table: 'stores', column: 'name' },
      'name': { table: 'stores', column: 'name' },
      'description': { table: 'stores', column: 'description' },
      'store_description': { table: 'stores', column: 'description' },
      'primary_color': { table: 'stores', column: 'settings', path: ['theme', 'primaryColor'] },
      'theme.primaryColor': { table: 'stores', column: 'settings', path: ['theme', 'primaryColor'] },
      'theme.secondaryColor': { table: 'stores', column: 'settings', path: ['theme', 'secondaryColor'] }
    };

    const mapping = settingMap[setting] || { table: table || 'stores', column: setting };

    if (mapping.path) {
      // Handle nested JSON update
      const { data: current, error: fetchError } = await tenantDb
        .from(mapping.table)
        .select(mapping.column)
        .eq('id', storeId)
        .single();

      if (fetchError) throw new Error(fetchError.message);

      let obj = current[mapping.column] || {};
      let ref = obj;
      for (let i = 0; i < mapping.path.length - 1; i++) {
        if (!ref[mapping.path[i]]) ref[mapping.path[i]] = {};
        ref = ref[mapping.path[i]];
      }
      ref[mapping.path[mapping.path.length - 1]] = value;

      const { error: updateError } = await tenantDb
        .from(mapping.table)
        .update({ [mapping.column]: obj, updated_at: new Date().toISOString() })
        .eq('id', storeId);

      if (updateError) throw new Error(updateError.message);
    } else {
      // Direct column update
      const { error } = await tenantDb
        .from(mapping.table)
        .update({ [mapping.column]: value, updated_at: new Date().toISOString() })
        .eq('id', storeId);

      if (error) throw new Error(error.message);
    }

    return {
      success: true,
      setting,
      value,
      table: mapping.table,
      column: mapping.column,
      message: `Updated ${setting} to "${typeof value === 'string' ? value.substring(0, 50) : value}"`
    };
  }

  /**
   * Get AI context from ai_context_documents (master DB)
   * Retrieves architecture docs, best practices, tutorials
   */
  async _executeGetAiContext({ type, category, search, limit = 5 }, context) {
    const { masterDbClient } = require('../database/masterConnection');

    let query = masterDbClient
      .from('ai_context_documents')
      .select('id, type, title, content, category, tags, priority')
      .eq('is_active', true)
      .order('priority', { ascending: false })
      .limit(limit);

    if (type) {
      query = query.eq('type', type);
    }

    if (category) {
      query = query.eq('category', category);
    }

    if (search) {
      query = query.or(`title.ilike.%${search}%,content.ilike.%${search}%`);
    }

    const { data: docs, error } = await query;

    if (error) {
      return { success: false, error: error.message };
    }

    return {
      success: true,
      documents: docs?.map(d => ({
        id: d.id,
        type: d.type,
        title: d.title,
        category: d.category,
        tags: d.tags,
        content: d.content,
        priority: d.priority
      })) || [],
      count: docs?.length || 0,
      message: `Found ${docs?.length || 0} context documents`,
      hint: docs?.length === 0
        ? 'Try broader search terms or different type/category'
        : `Categories: ${[...new Set(docs.map(d => d.category))].join(', ')}`
    };
  }

  /**
   * Get system overview - architecture, admin sidebar, features
   * Combines AI context with actual system exploration
   */
  async _executeGetSystemOverview({ area = 'all' }, context) {
    const { storeId } = context;
    const result = { success: true };

    // Try to get AI context for detailed docs
    let aiDocs = {};
    try {
      const { masterDbClient } = require('../database/masterConnection');
      const { data } = await masterDbClient
        .from('ai_context_documents')
        .select('title, content, category')
        .eq('is_active', true)
        .in('category', ['core', 'architecture', 'admin', 'slots', 'plugins'])
        .limit(20);
      if (data) {
        data.forEach(d => {
          if (!aiDocs[d.category]) aiDocs[d.category] = [];
          aiDocs[d.category].push({ title: d.title, content: d.content?.substring(0, 500) });
        });
      }
    } catch (e) { /* continue without AI docs */ }

    if (area === 'all' || area === 'architecture') {
      result.architecture = {
        overview: 'Multi-tenant e-commerce platform',
        stack: {
          frontend: 'React + Vite + TailwindCSS',
          backend: 'Node.js + Express',
          database: 'PostgreSQL (Supabase) - Master DB + Tenant DBs',
          hosting: 'Vercel (frontend) + Render (backend)'
        },
        databases: {
          master: 'Shared tables: users, stores, ai_*, theme_defaults',
          tenant: 'Store-specific: products, orders, customers, slot_configurations'
        },
        aiDocs: aiDocs['architecture'] || aiDocs['core'] || null
      };
    }

    if (area === 'all' || area === 'admin_sidebar') {
      result.adminSidebar = {
        sections: [
          { name: 'Dashboard', path: '/admin', icon: 'LayoutDashboard' },
          { name: 'Products', path: '/admin/products', icon: 'Package', features: ['list', 'create', 'edit', 'images', 'variants'] },
          { name: 'Categories', path: '/admin/categories', icon: 'FolderTree', features: ['hierarchy', 'images', 'attributes'] },
          { name: 'Orders', path: '/admin/orders', icon: 'ShoppingCart', features: ['list', 'details', 'status', 'fulfillment'] },
          { name: 'Customers', path: '/admin/customers', icon: 'Users', features: ['list', 'details', 'orders', 'segments'] },
          { name: 'Content', path: '/admin/content', icon: 'FileText', subsections: ['CMS Pages', 'CMS Blocks', 'Media Library'] },
          { name: 'Design', path: '/admin/design', icon: 'Palette', subsections: ['Theme Editor', 'Slot Editor', 'Header/Footer'] },
          { name: 'Marketing', path: '/admin/marketing', icon: 'Megaphone', subsections: ['Coupons', 'Campaigns', 'Email Templates'] },
          { name: 'Settings', path: '/admin/settings', icon: 'Settings', subsections: ['Store', 'Payments', 'Shipping', 'SEO', 'Integrations'] },
          { name: 'AI Workspace', path: '/admin/ai-workspace', icon: 'Sparkles', features: ['Chat', 'Plugin Builder', 'Store Editor'] }
        ],
        aiDocs: aiDocs['admin'] || null
      };
    }

    if (area === 'all' || area === 'admin_features') {
      result.adminFeatures = {
        products: ['CRUD', 'Bulk edit', 'Import/Export', 'Variants', 'Attributes', 'SEO', 'Images'],
        content: ['CMS Pages', 'CMS Blocks', 'Translations', 'Media Manager'],
        design: ['Slot-based layouts', 'Theme customization', 'Header/Footer editor', 'Custom CSS'],
        marketing: ['Coupons', 'Campaigns', 'Customer segments', 'Email automation'],
        ai: ['Chat assistant', 'Plugin generation', 'Store editing via chat', 'Image optimization']
      };
    }

    if (area === 'all' || area === 'slot_system') {
      result.slotSystem = {
        description: 'Drag-and-drop page builder using slots',
        tables: ['slot_configurations'],
        structure: {
          slots: 'Object of slot definitions { slotId: { type, content, styles, children } }',
          rootSlots: 'Array of top-level slot IDs',
          layout: 'Grid system with colSpan (1-12)'
        },
        slotTypes: ['container', 'text', 'image', 'button', 'link', 'html', 'grid', 'flex', 'input'],
        customSlots: 'Created via plugin_registry with type="slot_type"',
        pageTypes: ['product', 'category', 'cart', 'checkout', 'header', 'footer', 'homepage'],
        aiDocs: aiDocs['slots'] || null
      };
    }

    if (area === 'all' || area === 'plugin_system') {
      result.pluginSystem = {
        description: 'Extensibility via database-stored plugins',
        table: 'plugin_registry',
        types: ['slot_type', 'widget', 'integration', 'automation'],
        structure: {
          name: 'Plugin identifier',
          type: 'Plugin type',
          configuration: 'JSON config with props, template, dataSource',
          status: 'active/inactive'
        },
        aiDocs: aiDocs['plugins'] || null
      };
    }

    result.message = `System overview for: ${area}`;
    result.hint = 'Use explore_schema or get_ai_context for more detailed information';

    return result;
  }

  // ============================================
  // CRUD TOOL IMPLEMENTATIONS
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
    return `You are an AI assistant for managing an e-commerce store. Work like Claude Code - EXPLORE first, UNDERSTAND the system, then ACT intelligently.

## SELF-LEARNING AI

You automatically learn and get smarter over time:
- When you explore a table, discoveries are AUTO-SAVED to AI tables
- No manual training needed - you train yourself as you work
- AI tables are hints/cache, actual DB is always truth
- Use \`learn\` tool to explicitly save patterns, insights, or context

## EXPLORATION-FIRST WORKFLOW

**Before making any changes**, understand the system:
1. Use \`explore_schema\` to discover tables (auto-learns if not in AI tables)
2. Use \`get_system_overview\` for architecture, admin sidebar, features
3. Use \`discover_components\` to see available UI components
4. Use \`query_database\` to read current data

The LLM's intelligence + exploration = understanding. AI tables are just cache.

## TOOL USAGE

### Learning Tools:
- \`learn\`: Explicitly save knowledge (entity schemas, patterns, insights)
  - Called automatically by explore_schema when gaps found
  - Use manually after successful operations to save patterns

### Exploration Tools:
- \`explore_schema\`: Discover tables, AUTO-LEARNS missing schemas
- \`get_system_overview\`: Architecture, admin sidebar, features
- \`discover_components\`: Find slot types from ai_code_patterns
- \`get_ai_context\`: Get docs from ai_context_documents
- \`query_database\`: Read any table directly

### Action Tools:
- \`update_store_setting\`: Update logo, name, theme
- \`configure_layout\`: Add/update/remove slots in page layouts
- \`create_component\`: Create new slot type (saved to plugin_registry)
- \`create_record\` / \`update_record\`: CRUD on any entity

## INTELLIGENT COMPONENT CREATION

When user requests something that doesn't exist:
1. Use \`discover_components\` to check if it exists
2. If NOT found: "I don't see that component. Want me to create it?"
3. If YES: \`create_component\` → saves to plugin_registry
4. Then \`configure_layout\` to add it to page
5. Optionally: \`learn\` to save as pattern for future

## EXAMPLES

**User: "Add this logo"**
1. explore_schema(search="logo") → Finds stores.logo_url, AUTO-LEARNS if needed
2. update_store_setting(setting="logo_url", value="<url>")

**User: "Add mega menu"**
1. discover_components(search="mega-menu") → Not found
2. "Want me to create a mega-menu component?"
3. create_component(name="mega-menu", definition={...})
4. configure_layout(pageType="header", operation="add_slot", slotType="mega-menu")
5. learn(type="pattern", data={name:"mega-menu", ...}) → Saves for future

**User: "What admin features exist?"**
1. get_system_overview(area="admin_features")
2. Explain based on discovered info

## GUIDELINES

- LLM intelligence + exploration = understanding
- AI tables are cache/hints, DB is truth
- Auto-learn fills gaps as you explore
- Use \`learn\` after successful complex operations
- Always confirm destructive actions`;
  }
}

module.exports = new GenericApiToolService();
