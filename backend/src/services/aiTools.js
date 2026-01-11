/**
 * AI Tools Definition
 *
 * Tools that Claude can use to dynamically look up information
 * about the DainoStore platform. This replaces static training data
 * with real-time tool calls.
 */

const { masterDbClient } = require('../database/masterConnection');
const ConnectionManager = require('./database/ConnectionManager');

/**
 * Tool definitions for Anthropic's tool use API
 */
const PLATFORM_TOOLS = [
  {
    name: "get_platform_knowledge",
    description: "Get knowledge about DainoStore platform features, concepts, and how things work. Use this for questions about: credits, pricing, models, translations, slots, plugins, settings, architecture, or any 'how does X work' questions.",
    input_schema: {
      type: "object",
      properties: {
        topic: {
          type: "string",
          description: "The topic to look up. Examples: 'credit pricing', 'llm models', 'translations', 'slot system', 'plugin development', 'store settings', 'theme configuration'"
        },
        question: {
          type: "string",
          description: "The specific question being asked, for better context matching"
        }
      },
      required: ["topic"]
    }
  },
  {
    name: "query_database",
    description: "Query the store's database for real data. Use this for questions about products, orders, customers, categories, inventory, sales, revenue, or any data-related questions.",
    input_schema: {
      type: "object",
      properties: {
        entity: {
          type: "string",
          enum: ["products", "orders", "customers", "categories", "inventory", "reviews", "coupons", "analytics"],
          description: "The type of data to query"
        },
        query_type: {
          type: "string",
          enum: ["count", "list", "aggregate", "search", "stats"],
          description: "Type of query to perform"
        },
        filters: {
          type: "object",
          description: "Optional filters like { status: 'active', limit: 10 }"
        }
      },
      required: ["entity", "query_type"]
    }
  },
  {
    name: "get_store_settings",
    description: "Get current store configuration and settings. Use this when user asks about current settings, theme, or configuration.",
    input_schema: {
      type: "object",
      properties: {
        area: {
          type: "string",
          enum: ["theme", "payments", "shipping", "general", "seo", "emails", "all"],
          description: "The settings area to retrieve"
        }
      },
      required: ["area"]
    }
  },
  {
    name: "update_store_setting",
    description: "Update a store setting. Use this when user wants to change a setting, theme color, or configuration.",
    input_schema: {
      type: "object",
      properties: {
        setting_path: {
          type: "string",
          description: "The setting path to update. Examples: 'theme.primaryColor', 'show_stock_label', 'hide_currency_product'"
        },
        value: {
          type: ["string", "boolean", "number"],
          description: "The new value for the setting"
        }
      },
      required: ["setting_path", "value"]
    }
  },
  {
    name: "modify_page_layout",
    description: "Modify page layout by moving, showing, hiding, or styling slots. Use this for layout and styling changes.",
    input_schema: {
      type: "object",
      properties: {
        page_type: {
          type: "string",
          enum: ["product", "category", "cart", "checkout", "homepage", "header"],
          description: "The page to modify"
        },
        action: {
          type: "string",
          enum: ["move", "show", "hide", "style"],
          description: "What action to take"
        },
        slot_id: {
          type: "string",
          description: "The slot to modify (e.g., 'product_title', 'price_container', 'add_to_cart_button')"
        },
        details: {
          type: "object",
          description: "Action-specific details. For move: { position: 'before'|'after', target: 'slot_id' }. For style: { property: 'color', value: '#FF0000' }"
        }
      },
      required: ["page_type", "action", "slot_id"]
    }
  },
  {
    name: "manage_entity",
    description: "Create, update, or delete store entities like products, categories, coupons, cms pages, etc.",
    input_schema: {
      type: "object",
      properties: {
        entity_type: {
          type: "string",
          enum: ["product", "category", "coupon", "cms_page", "cms_block", "product_label", "attribute", "tax_rate"],
          description: "Type of entity to manage"
        },
        operation: {
          type: "string",
          enum: ["create", "update", "delete", "list"],
          description: "Operation to perform"
        },
        data: {
          type: "object",
          description: "Entity data for create/update operations"
        },
        identifier: {
          type: "string",
          description: "Entity ID or identifier for update/delete operations"
        }
      },
      required: ["entity_type", "operation"]
    }
  },
  {
    name: "translate_content",
    description: "Translate content to another language using AI.",
    input_schema: {
      type: "object",
      properties: {
        entity_type: {
          type: "string",
          enum: ["product", "category", "cms_page", "cms_block", "email_template"],
          description: "Type of content to translate"
        },
        entity_id: {
          type: "string",
          description: "ID of the entity to translate (optional for bulk)"
        },
        target_language: {
          type: "string",
          description: "Target language code (e.g., 'de', 'fr', 'nl')"
        },
        fields: {
          type: "array",
          items: { type: "string" },
          description: "Fields to translate (e.g., ['name', 'description'])"
        }
      },
      required: ["entity_type", "target_language"]
    }
  }
];

/**
 * Execute a tool call and return the result
 */
async function executeTool(toolName, toolInput, context = {}) {
  const { storeId, userId } = context;

  console.log(`🔧 Executing tool: ${toolName}`, JSON.stringify(toolInput).substring(0, 200));

  switch (toolName) {
    case 'get_platform_knowledge':
      return await getPlatformKnowledge(toolInput);

    case 'query_database':
      return await queryDatabase(toolInput, storeId);

    case 'get_store_settings':
      return await getStoreSettings(toolInput, storeId);

    case 'update_store_setting':
      return await updateStoreSetting(toolInput, storeId, userId);

    case 'modify_page_layout':
      return await modifyPageLayout(toolInput, storeId, userId);

    case 'manage_entity':
      return await manageEntity(toolInput, storeId, userId);

    case 'translate_content':
      return await translateContent(toolInput, storeId);

    default:
      return { error: `Unknown tool: ${toolName}` };
  }
}

/**
 * Get platform knowledge from the knowledge base
 */
async function getPlatformKnowledge({ topic, question }) {
  try {
    // Search knowledge base by topic keywords
    const searchTerms = topic.toLowerCase().split(' ');

    // Query ai_context_documents for matching content
    let query = masterDbClient
      .from('ai_context_documents')
      .select('title, content, type, category')
      .eq('is_active', true)
      .order('priority', { ascending: false })
      .limit(5);

    // Search in title and content using ilike
    const { data: docs, error } = await query;

    if (error) {
      console.error('Knowledge query error:', error);
      return { error: 'Failed to search knowledge base' };
    }

    // Filter docs that match the topic
    const matchingDocs = (docs || []).filter(doc => {
      const titleMatch = searchTerms.some(term =>
        doc.title?.toLowerCase().includes(term) ||
        doc.category?.toLowerCase().includes(term)
      );
      const contentMatch = searchTerms.some(term =>
        doc.content?.toLowerCase().includes(term)
      );
      return titleMatch || contentMatch;
    });

    if (matchingDocs.length === 0) {
      // Fallback to hardcoded essential knowledge
      return getHardcodedKnowledge(topic);
    }

    // Format the knowledge for the AI
    const knowledge = matchingDocs.map(doc =>
      `## ${doc.title}\n${doc.content}`
    ).join('\n\n');

    return {
      found: true,
      topic,
      knowledge,
      sources: matchingDocs.map(d => d.title)
    };
  } catch (error) {
    console.error('getPlatformKnowledge error:', error);
    return getHardcodedKnowledge(topic);
  }
}

/**
 * Hardcoded essential platform knowledge as fallback
 */
function getHardcodedKnowledge(topic) {
  const knowledge = {
    'credit': {
      found: true,
      topic: 'credits',
      knowledge: `## Credit Pricing

Credits are used for AI operations. Cost per 1000 tokens:

**Claude Models:**
- Claude 3.5 Sonnet: 3 credits input / 15 credits output (recommended for most tasks)
- Claude 3 Haiku: 0.25 credits input / 1.25 credits output (fast & cheap)
- Claude 3 Opus: 15 credits input / 75 credits output (highest quality)

**GPT Models:**
- GPT-4o: 2.5 credits input / 10 credits output
- GPT-4o-mini: 0.15 credits input / 0.6 credits output (cheapest)

**Typical Usage:**
- Simple chat: 1-5 credits
- Product description: 5-20 credits
- Plugin generation: 20-100 credits
- Bulk translations: 100+ credits

**Plans:**
- Starter: 1,000 credits/month
- Professional: 10,000 credits/month
- Enterprise: 100,000+ credits/month
- Overage: $0.01 per credit

So 500 credits = $5.00 at overage rate, or included in your plan allocation.`
    },
    'model': {
      found: true,
      topic: 'llm models',
      knowledge: `## LLM Model Selection

**For Coding/Complex Tasks:** Claude 3.5 Sonnet (best quality/cost balance)
**For Quick/Simple Tasks:** Claude 3 Haiku or GPT-4o-mini (10x cheaper)
**For Highest Quality:** Claude 3 Opus (5x more expensive, best reasoning)
**For Long Documents:** Gemini 1.5 Pro (1M token context)

**Task Recommendations:**
- Chat responses → Sonnet
- Quick Q&A → Haiku
- Code generation → Sonnet
- Translations → Sonnet (quality) or GPT-4o-mini (bulk/cheap)
- Product descriptions → Haiku
- Complex analysis → Opus`
    },
    'translation': {
      found: true,
      topic: 'translations',
      knowledge: `## AI Translation System

Translations are stored in the 'translations' JSONB column on each entity.
Structure: { "en": { "name": "...", "description": "..." }, "de": { ... } }

**To translate via Admin:**
1. Go to entity (Product/Category/Page)
2. Click "Translations" tab
3. Select target language
4. Click "Auto-Translate" for AI translation
5. Review and save

**Bulk Translation:**
Admin → Settings → Languages → "Translate All"

**API:** POST /api/translations/translate
{ entity_type, entity_id, source_language, target_language, fields }`
    },
    'slot': {
      found: true,
      topic: 'slot system',
      knowledge: `## Slot-Based Page System

DainoStore uses a slot-based layout system, NOT raw HTML.

**Concepts:**
- Pages are built from configurable slots (components)
- Each slot has: type, props, children, styles
- Slots are stored in slot_configurations table
- Changes are made via slot configuration, not HTML editing

**Common Slots:**
- product_title, product_sku, product_price, price_container
- stock_status, add_to_cart_button, product_gallery
- header_logo, header_navigation, mini_cart

**Page Types:** product, category, cart, checkout, homepage, header`
    },
    'plugin': {
      found: true,
      topic: 'plugin development',
      knowledge: `## Plugin Development

Plugins extend DainoStore functionality. They can add:
- Custom slot types (React components)
- Backend routes (Express handlers)
- Admin pages
- Cron jobs
- Database migrations

**Structure:**
- manifest.json: Plugin metadata and configuration
- frontend/: React components
- backend/: Express routes and services
- migrations/: Database schema changes

**Creating Plugins:**
Use the AI Workspace → "Create a plugin that..." or
Admin → Plugins → Developer → New Plugin`
    }
  };

  // Find matching knowledge by keyword
  const topicLower = topic.toLowerCase();
  for (const [key, value] of Object.entries(knowledge)) {
    if (topicLower.includes(key)) {
      return value;
    }
  }

  return {
    found: false,
    topic,
    knowledge: `I don't have specific documentation about "${topic}". You can ask me to look up related topics or check the Admin panel for more information.`
  };
}

/**
 * Query the store database
 */
async function queryDatabase({ entity, query_type, filters = {} }, storeId) {
  if (!storeId) {
    return { error: 'Store ID required for database queries' };
  }

  try {
    const tenantDb = await ConnectionManager.getStoreConnection(storeId);

    switch (entity) {
      case 'products': {
        let query = tenantDb.from('products').select('id, sku, translations, price, stock_quantity, status');
        if (filters.status) query = query.eq('status', filters.status);
        if (filters.limit) query = query.limit(filters.limit);
        else query = query.limit(20);

        if (query_type === 'count') {
          const { count } = await tenantDb.from('products').select('*', { count: 'exact', head: true });
          return { entity: 'products', count, query_type };
        }

        const { data, error } = await query;
        if (error) return { error: error.message };

        // Extract names from translations
        const products = (data || []).map(p => ({
          id: p.id,
          sku: p.sku,
          name: p.translations?.en?.name || p.translations?.default?.name || 'Unnamed',
          price: p.price,
          stock: p.stock_quantity,
          status: p.status
        }));

        return { entity: 'products', data: products, count: products.length };
      }

      case 'orders': {
        let query = tenantDb.from('orders').select('id, order_number, total, status, created_at');
        if (filters.status) query = query.eq('status', filters.status);
        if (filters.limit) query = query.limit(filters.limit);
        else query = query.limit(20);
        query = query.order('created_at', { ascending: false });

        if (query_type === 'count') {
          const { count } = await tenantDb.from('orders').select('*', { count: 'exact', head: true });
          return { entity: 'orders', count, query_type };
        }

        if (query_type === 'stats') {
          const { data } = await tenantDb.from('orders').select('total, status');
          const stats = {
            total_orders: data?.length || 0,
            total_revenue: data?.reduce((sum, o) => sum + (parseFloat(o.total) || 0), 0) || 0,
            by_status: {}
          };
          data?.forEach(o => {
            stats.by_status[o.status] = (stats.by_status[o.status] || 0) + 1;
          });
          return { entity: 'orders', stats };
        }

        const { data, error } = await query;
        if (error) return { error: error.message };
        return { entity: 'orders', data, count: data?.length };
      }

      case 'categories': {
        const { data, error } = await tenantDb
          .from('categories')
          .select('id, code, translations, is_active, parent_id')
          .limit(filters.limit || 50);

        if (error) return { error: error.message };

        const categories = (data || []).map(c => ({
          id: c.id,
          code: c.code,
          name: c.translations?.en?.name || c.code,
          active: c.is_active,
          parent_id: c.parent_id
        }));

        return { entity: 'categories', data: categories, count: categories.length };
      }

      case 'customers': {
        if (query_type === 'count') {
          const { count } = await tenantDb.from('customers').select('*', { count: 'exact', head: true });
          return { entity: 'customers', count, query_type };
        }

        const { data, error } = await tenantDb
          .from('customers')
          .select('id, email, first_name, last_name, created_at')
          .limit(filters.limit || 20);

        if (error) return { error: error.message };
        return { entity: 'customers', data, count: data?.length };
      }

      default:
        return { error: `Query for entity "${entity}" not implemented yet` };
    }
  } catch (error) {
    console.error('queryDatabase error:', error);
    return { error: error.message };
  }
}

/**
 * Get store settings
 */
async function getStoreSettings({ area }, storeId) {
  if (!storeId) {
    return { error: 'Store ID required' };
  }

  try {
    const tenantDb = await ConnectionManager.getStoreConnection(storeId);
    const { data: store, error } = await tenantDb
      .from('stores')
      .select('settings')
      .eq('id', storeId)
      .single();

    if (error) return { error: error.message };

    const settings = store?.settings || {};

    if (area === 'all') {
      return { settings };
    }

    if (area === 'theme') {
      return {
        theme: settings.theme || {},
        note: 'Theme settings include primaryColor, secondaryColor, fonts, etc.'
      };
    }

    return {
      area,
      settings: settings[area] || {},
      available_areas: Object.keys(settings)
    };
  } catch (error) {
    return { error: error.message };
  }
}

/**
 * Update a store setting
 */
async function updateStoreSetting({ setting_path, value }, storeId, userId) {
  if (!storeId) {
    return { error: 'Store ID required' };
  }

  try {
    const tenantDb = await ConnectionManager.getStoreConnection(storeId);

    // Get current settings
    const { data: store, error: fetchError } = await tenantDb
      .from('stores')
      .select('settings')
      .eq('id', storeId)
      .single();

    if (fetchError) return { error: fetchError.message };

    const settings = store?.settings || {};

    // Update nested setting path
    const pathParts = setting_path.split('.');
    let current = settings;
    for (let i = 0; i < pathParts.length - 1; i++) {
      if (!current[pathParts[i]]) current[pathParts[i]] = {};
      current = current[pathParts[i]];
    }
    current[pathParts[pathParts.length - 1]] = value;

    // Save updated settings
    const { error: updateError } = await tenantDb
      .from('stores')
      .update({ settings, updated_at: new Date().toISOString() })
      .eq('id', storeId);

    if (updateError) return { error: updateError.message };

    return {
      success: true,
      message: `Updated ${setting_path} to ${JSON.stringify(value)}`,
      setting_path,
      value
    };
  } catch (error) {
    return { error: error.message };
  }
}

/**
 * Modify page layout (slots)
 */
async function modifyPageLayout({ page_type, action, slot_id, details = {} }, storeId, userId) {
  if (!storeId) {
    return { error: 'Store ID required' };
  }

  try {
    const tenantDb = await ConnectionManager.getStoreConnection(storeId);

    // Get current slot configuration
    const { data: config, error: fetchError } = await tenantDb
      .from('slot_configurations')
      .select('*')
      .eq('store_id', storeId)
      .eq('page_type', page_type)
      .eq('is_draft', true)
      .single();

    if (fetchError && fetchError.code !== 'PGRST116') {
      return { error: fetchError.message };
    }

    if (!config) {
      return { error: `No draft configuration found for ${page_type} page` };
    }

    const configuration = config.configuration || { slots: {}, rootSlots: [] };

    switch (action) {
      case 'style': {
        if (!configuration.slots[slot_id]) {
          return { error: `Slot "${slot_id}" not found on ${page_type} page` };
        }

        const { property, value } = details;
        if (!configuration.slots[slot_id].styles) {
          configuration.slots[slot_id].styles = {};
        }
        configuration.slots[slot_id].styles[property] = value;
        break;
      }

      case 'hide': {
        if (!configuration.slots[slot_id]) {
          return { error: `Slot "${slot_id}" not found` };
        }
        configuration.slots[slot_id].props = configuration.slots[slot_id].props || {};
        configuration.slots[slot_id].props.hidden = true;
        break;
      }

      case 'show': {
        if (!configuration.slots[slot_id]) {
          return { error: `Slot "${slot_id}" not found` };
        }
        configuration.slots[slot_id].props = configuration.slots[slot_id].props || {};
        configuration.slots[slot_id].props.hidden = false;
        break;
      }

      case 'move': {
        // Implement move logic
        const { position, target } = details;
        // This would require more complex slot reordering logic
        return {
          success: true,
          message: `Move ${slot_id} ${position} ${target} - use the visual editor for complex layout changes`,
          requires_manual: true
        };
      }
    }

    // Save updated configuration
    const { error: updateError } = await tenantDb
      .from('slot_configurations')
      .update({
        configuration,
        updated_at: new Date().toISOString(),
        has_unpublished_changes: true
      })
      .eq('id', config.id);

    if (updateError) return { error: updateError.message };

    return {
      success: true,
      message: `Updated ${slot_id} on ${page_type} page: ${action}`,
      action,
      slot_id,
      page_type,
      note: 'Changes saved to draft. Publish to make them live.'
    };
  } catch (error) {
    return { error: error.message };
  }
}

/**
 * Manage store entities (CRUD)
 */
async function manageEntity({ entity_type, operation, data = {}, identifier }, storeId, userId) {
  if (!storeId) {
    return { error: 'Store ID required' };
  }

  try {
    const tenantDb = await ConnectionManager.getStoreConnection(storeId);

    const tableMap = {
      product: 'products',
      category: 'categories',
      coupon: 'coupons',
      cms_page: 'cms_pages',
      cms_block: 'cms_blocks',
      product_label: 'product_labels',
      attribute: 'attributes',
      tax_rate: 'tax_rates'
    };

    const table = tableMap[entity_type];
    if (!table) {
      return { error: `Unknown entity type: ${entity_type}` };
    }

    switch (operation) {
      case 'list': {
        const { data: items, error } = await tenantDb
          .from(table)
          .select('*')
          .limit(20);

        if (error) return { error: error.message };
        return { entity_type, operation, data: items, count: items?.length };
      }

      case 'create': {
        const { data: created, error } = await tenantDb
          .from(table)
          .insert({ ...data, store_id: storeId })
          .select()
          .single();

        if (error) return { error: error.message };
        return {
          success: true,
          message: `Created ${entity_type}`,
          entity_type,
          operation,
          data: created
        };
      }

      case 'update': {
        if (!identifier) return { error: 'Identifier required for update' };

        const { error } = await tenantDb
          .from(table)
          .update({ ...data, updated_at: new Date().toISOString() })
          .eq('id', identifier);

        if (error) return { error: error.message };
        return {
          success: true,
          message: `Updated ${entity_type} ${identifier}`,
          entity_type,
          operation
        };
      }

      case 'delete': {
        if (!identifier) return { error: 'Identifier required for delete' };

        const { error } = await tenantDb
          .from(table)
          .delete()
          .eq('id', identifier);

        if (error) return { error: error.message };
        return {
          success: true,
          message: `Deleted ${entity_type} ${identifier}`,
          entity_type,
          operation
        };
      }

      default:
        return { error: `Unknown operation: ${operation}` };
    }
  } catch (error) {
    return { error: error.message };
  }
}

/**
 * Translate content using AI
 */
async function translateContent({ entity_type, entity_id, target_language, fields }, storeId) {
  // This would call the translation service
  return {
    message: `Translation request queued: ${entity_type} to ${target_language}`,
    entity_type,
    target_language,
    fields: fields || ['name', 'description'],
    note: 'Use Admin → Translations for bulk translation, or I can translate specific text for you.'
  };
}

module.exports = {
  PLATFORM_TOOLS,
  executeTool,
  getPlatformKnowledge,
  getHardcodedKnowledge
};
