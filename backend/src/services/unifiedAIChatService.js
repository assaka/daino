/**
 * Unified AI Chat Service
 *
 * Single tool-based AI chat that handles ALL modes:
 * - Workspace (slot editing, styling, layout)
 * - Plugin development
 * - General questions
 * - Database queries
 * - Translations
 * - Settings updates
 *
 * Uses Anthropic's tool_use API for dynamic, intelligent responses.
 */

const Anthropic = require('@anthropic-ai/sdk');
const { masterDbClient } = require('../database/masterConnection');
const ConnectionManager = require('./database/ConnectionManager');

const anthropic = new Anthropic();

/**
 * Tool definitions for all AI capabilities
 */
const TOOLS = [
  {
    name: "search_knowledge",
    description: "Search the platform knowledge base for documentation, guides, and how-to information. Use for questions about: credits, pricing, models, translations, slots, plugins, settings, architecture, features.",
    input_schema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Search query - what the user wants to know about"
        }
      },
      required: ["query"]
    }
  },
  {
    name: "query_store_data",
    description: "Query the store's database for products, orders, customers, categories, inventory, coupons, etc. Use for any data-related questions.",
    input_schema: {
      type: "object",
      properties: {
        entity: {
          type: "string",
          enum: ["products", "orders", "customers", "categories", "coupons", "attributes", "reviews"],
          description: "Type of data to query"
        },
        operation: {
          type: "string",
          enum: ["count", "list", "search", "stats"],
          description: "What to do with the data"
        },
        filters: {
          type: "object",
          description: "Filters like { status: 'active', limit: 10, search: 'keyword' }"
        }
      },
      required: ["entity", "operation"]
    }
  },
  {
    name: "get_store_settings",
    description: "Get current store configuration - theme colors, display options, payment settings, etc.",
    input_schema: {
      type: "object",
      properties: {
        area: {
          type: "string",
          enum: ["theme", "display", "payments", "shipping", "all"],
          description: "Settings area to retrieve"
        }
      },
      required: ["area"]
    }
  },
  {
    name: "update_store_setting",
    description: "Update a store setting - change theme colors, toggle features, etc.",
    input_schema: {
      type: "object",
      properties: {
        setting_path: {
          type: "string",
          description: "Setting path like 'theme.primaryColor' or 'show_stock_label'"
        },
        value: {
          description: "New value for the setting"
        }
      },
      required: ["setting_path", "value"]
    }
  },
  {
    name: "modify_slot",
    description: "Modify page layout - style slots, show/hide elements, change colors, fonts, spacing.",
    input_schema: {
      type: "object",
      properties: {
        page_type: {
          type: "string",
          enum: ["product", "category", "cart", "checkout", "homepage", "header"],
          description: "Which page to modify"
        },
        slot_id: {
          type: "string",
          description: "Slot to modify: product_title, product_sku, price_container, add_to_cart_button, etc."
        },
        action: {
          type: "string",
          enum: ["style", "show", "hide", "move"],
          description: "What to do"
        },
        styles: {
          type: "object",
          description: "For style action: { color: '#FF0000', fontSize: '18px', fontWeight: 'bold' }"
        }
      },
      required: ["page_type", "slot_id", "action"]
    }
  },
  {
    name: "manage_entity",
    description: "Create, update, or delete store entities - products, categories, coupons, CMS pages, etc.",
    input_schema: {
      type: "object",
      properties: {
        entity_type: {
          type: "string",
          enum: ["product", "category", "coupon", "cms_page", "cms_block", "product_label", "attribute"],
          description: "Type of entity"
        },
        operation: {
          type: "string",
          enum: ["create", "update", "delete"],
          description: "What to do"
        },
        data: {
          type: "object",
          description: "Entity data for create/update"
        },
        id: {
          type: "string",
          description: "Entity ID for update/delete"
        }
      },
      required: ["entity_type", "operation"]
    }
  },
  {
    name: "generate_plugin_code",
    description: "Generate plugin code for custom functionality - React components, backend routes, admin pages.",
    input_schema: {
      type: "object",
      properties: {
        description: {
          type: "string",
          description: "What the plugin should do"
        },
        features: {
          type: "array",
          items: { type: "string" },
          description: "List of features needed"
        }
      },
      required: ["description"]
    }
  },
  {
    name: "translate_content",
    description: "Translate content to another language.",
    input_schema: {
      type: "object",
      properties: {
        text: {
          type: "string",
          description: "Text to translate (or entity_type + entity_id for stored content)"
        },
        target_language: {
          type: "string",
          description: "Target language code: de, fr, nl, es, etc."
        },
        entity_type: {
          type: "string",
          description: "Optional: product, category, cms_page - to translate stored entity"
        },
        entity_id: {
          type: "string",
          description: "Optional: ID of entity to translate"
        }
      },
      required: ["target_language"]
    }
  },
  {
    name: "update_order_status",
    description: "Update an order's status, payment status, or fulfillment status. Use when user asks to mark orders as shipped, paid, completed, cancelled, etc.",
    input_schema: {
      type: "object",
      properties: {
        order_id: {
          type: "string",
          description: "The order ID or order number to update"
        },
        status: {
          type: "string",
          enum: ["pending", "processing", "completed", "cancelled", "refunded", "on_hold"],
          description: "New order status"
        },
        payment_status: {
          type: "string",
          enum: ["pending", "paid", "failed", "refunded", "partially_refunded"],
          description: "New payment status"
        },
        fulfillment_status: {
          type: "string",
          enum: ["unfulfilled", "partially_fulfilled", "fulfilled", "shipped", "delivered", "returned"],
          description: "New fulfillment/shipping status"
        },
        tracking_number: {
          type: "string",
          description: "Shipping tracking number (optional)"
        },
        notes: {
          type: "string",
          description: "Internal notes about the status change (optional)"
        }
      },
      required: ["order_id"]
    }
  }
];

/**
 * System prompt for the unified AI
 */
const SYSTEM_PROMPT = `You are the AI assistant for DainoStore, a visual e-commerce platform.

You have tools to help users with ANYTHING they need:
- **search_knowledge**: Answer questions about the platform, pricing, features
- **query_store_data**: Get product, order, customer data from their store
- **get_store_settings / update_store_setting**: Check or change store configuration
- **modify_slot**: Change page layouts, colors, visibility of elements
- **manage_entity**: Create/update products, categories, coupons, pages
- **update_order_status**: Update order status, payment status, fulfillment status, add tracking
- **generate_plugin_code**: Create custom plugins and features
- **translate_content**: Translate text or stored content

IMPORTANT RULES:
1. USE TOOLS for any actionable request - don't just explain how to do things
2. For questions, use search_knowledge to find accurate answers
3. For data questions, query the actual database
4. Be conversational and helpful
5. When you complete an action, confirm what was done
6. If something fails, explain why and suggest alternatives

You're capable of both answering questions AND taking actions. Do whichever is appropriate.`;

/**
 * Execute a tool and return the result
 */
async function executeTool(name, input, context) {
  const { storeId, userId } = context;

  console.log(`🔧 Tool: ${name}`, JSON.stringify(input).substring(0, 100));

  switch (name) {
    case 'search_knowledge':
      return await searchKnowledge(input.query);

    case 'query_store_data':
      return await queryStoreData(input, storeId);

    case 'get_store_settings':
      return await getStoreSettings(input.area, storeId);

    case 'update_store_setting':
      return await updateStoreSetting(input.setting_path, input.value, storeId);

    case 'modify_slot':
      return await modifySlot(input, storeId);

    case 'manage_entity':
      return await manageEntity(input, storeId);

    case 'generate_plugin_code':
      return await generatePluginCode(input, context);

    case 'translate_content':
      return await translateContent(input, storeId);

    case 'update_order_status':
      return await updateOrderStatus(input, storeId);

    default:
      return { error: `Unknown tool: ${name}` };
  }
}

/**
 * Search knowledge base
 */
async function searchKnowledge(query) {
  try {
    const searchTerms = query.toLowerCase().split(' ').filter(t => t.length > 2);

    const { data: docs, error } = await masterDbClient
      .from('ai_context_documents')
      .select('title, content, category')
      .eq('is_active', true)
      .order('priority', { ascending: false })
      .limit(10);

    if (error) {
      return { found: false, error: error.message };
    }

    // Filter by relevance
    const matches = (docs || []).filter(doc => {
      const text = `${doc.title} ${doc.content} ${doc.category}`.toLowerCase();
      return searchTerms.some(term => text.includes(term));
    });

    if (matches.length === 0) {
      return {
        found: false,
        message: `No documentation found for "${query}". This topic may not be in the knowledge base yet.`
      };
    }

    return {
      found: true,
      results: matches.slice(0, 5).map(d => ({
        title: d.title,
        content: d.content,
        category: d.category
      }))
    };
  } catch (e) {
    return { found: false, error: e.message };
  }
}

/**
 * Query store data
 */
async function queryStoreData({ entity, operation, filters = {} }, storeId) {
  if (!storeId) return { error: 'No store selected' };

  try {
    const db = await ConnectionManager.getStoreConnection(storeId);
    const limit = filters.limit || 20;

    switch (entity) {
      case 'products': {
        if (operation === 'count') {
          const { count } = await db.from('products').select('*', { count: 'exact', head: true });
          return { entity: 'products', count };
        }
        const { data } = await db.from('products')
          .select('id, sku, translations, price, stock_quantity, status')
          .limit(limit);
        return {
          entity: 'products',
          count: data?.length,
          data: data?.map(p => ({
            sku: p.sku,
            name: p.translations?.en?.name || 'Unnamed',
            price: p.price,
            stock: p.stock_quantity,
            status: p.status
          }))
        };
      }

      case 'orders': {
        if (operation === 'count') {
          const { count } = await db.from('orders').select('*', { count: 'exact', head: true });
          return { entity: 'orders', count };
        }
        if (operation === 'stats') {
          const { data } = await db.from('orders').select('total, status');
          return {
            entity: 'orders',
            total_orders: data?.length || 0,
            revenue: data?.reduce((sum, o) => sum + (parseFloat(o.total) || 0), 0)
          };
        }
        const { data } = await db.from('orders')
          .select('id, order_number, total, status, created_at')
          .order('created_at', { ascending: false })
          .limit(limit);
        return { entity: 'orders', data };
      }

      case 'categories': {
        const { data } = await db.from('categories')
          .select('id, code, translations, is_active')
          .limit(limit);
        return {
          entity: 'categories',
          data: data?.map(c => ({
            code: c.code,
            name: c.translations?.en?.name || c.code,
            active: c.is_active
          }))
        };
      }

      case 'customers': {
        if (operation === 'count') {
          const { count } = await db.from('customers').select('*', { count: 'exact', head: true });
          return { entity: 'customers', count };
        }
        const { data } = await db.from('customers')
          .select('id, email, first_name, last_name')
          .limit(limit);
        return { entity: 'customers', data };
      }

      default:
        return { error: `Query for ${entity} not implemented` };
    }
  } catch (e) {
    return { error: e.message };
  }
}

/**
 * Get store settings
 */
async function getStoreSettings(area, storeId) {
  if (!storeId) return { error: 'No store selected' };

  try {
    const db = await ConnectionManager.getStoreConnection(storeId);
    const { data: store } = await db.from('stores').select('settings').eq('id', storeId).single();

    const settings = store?.settings || {};

    if (area === 'all') return { settings };
    if (area === 'theme') return { theme: settings.theme || {} };

    return { [area]: settings[area] || {} };
  } catch (e) {
    return { error: e.message };
  }
}

/**
 * Update store setting
 */
async function updateStoreSetting(path, value, storeId) {
  if (!storeId) return { error: 'No store selected' };

  try {
    const db = await ConnectionManager.getStoreConnection(storeId);
    const { data: store } = await db.from('stores').select('settings').eq('id', storeId).single();

    const settings = store?.settings || {};

    // Update nested path
    const parts = path.split('.');
    let current = settings;
    for (let i = 0; i < parts.length - 1; i++) {
      if (!current[parts[i]]) current[parts[i]] = {};
      current = current[parts[i]];
    }
    current[parts[parts.length - 1]] = value;

    await db.from('stores').update({ settings }).eq('id', storeId);

    return {
      success: true,
      message: `Updated ${path} to ${JSON.stringify(value)}`,
      refreshRequired: path.startsWith('theme')
    };
  } catch (e) {
    return { error: e.message };
  }
}

/**
 * Modify slot styling/visibility
 */
async function modifySlot({ page_type, slot_id, action, styles }, storeId) {
  if (!storeId) return { error: 'No store selected' };

  try {
    const db = await ConnectionManager.getStoreConnection(storeId);

    // Get current config
    const { data: config } = await db
      .from('slot_configurations')
      .select('*')
      .eq('store_id', storeId)
      .eq('page_type', page_type)
      .eq('is_draft', true)
      .single();

    if (!config) {
      return { error: `No draft configuration for ${page_type} page` };
    }

    const configuration = config.configuration || { slots: {} };

    if (!configuration.slots[slot_id]) {
      return { error: `Slot "${slot_id}" not found on ${page_type} page` };
    }

    switch (action) {
      case 'style':
        configuration.slots[slot_id].styles = {
          ...configuration.slots[slot_id].styles,
          ...styles
        };
        break;
      case 'hide':
        configuration.slots[slot_id].props = { ...configuration.slots[slot_id].props, hidden: true };
        break;
      case 'show':
        configuration.slots[slot_id].props = { ...configuration.slots[slot_id].props, hidden: false };
        break;
    }

    await db.from('slot_configurations')
      .update({ configuration, has_unpublished_changes: true })
      .eq('id', config.id);

    return {
      success: true,
      message: `${action === 'style' ? 'Styled' : action === 'hide' ? 'Hidden' : 'Shown'} ${slot_id} on ${page_type} page`,
      page_type,
      slot_id,
      action,
      refreshPreview: true
    };
  } catch (e) {
    return { error: e.message };
  }
}

/**
 * Manage entities (CRUD)
 */
async function manageEntity({ entity_type, operation, data, id }, storeId) {
  if (!storeId) return { error: 'No store selected' };

  const tableMap = {
    product: 'products',
    category: 'categories',
    coupon: 'coupons',
    cms_page: 'cms_pages',
    cms_block: 'cms_blocks',
    product_label: 'product_labels',
    attribute: 'attributes'
  };

  const table = tableMap[entity_type];
  if (!table) return { error: `Unknown entity: ${entity_type}` };

  try {
    const db = await ConnectionManager.getStoreConnection(storeId);

    switch (operation) {
      case 'create': {
        const { data: created, error } = await db
          .from(table)
          .insert({ ...data, store_id: storeId })
          .select()
          .single();
        if (error) return { error: error.message };
        return { success: true, message: `Created ${entity_type}`, data: created, refreshPreview: true, action: 'create' };
      }

      case 'update': {
        if (!id) return { error: 'ID required for update' };
        const { error } = await db.from(table).update(data).eq('id', id);
        if (error) return { error: error.message };
        return { success: true, message: `Updated ${entity_type}`, refreshPreview: true, action: 'update' };
      }

      case 'delete': {
        if (!id) return { error: 'ID required for delete' };
        const { error } = await db.from(table).delete().eq('id', id);
        if (error) return { error: error.message };
        return { success: true, message: `Deleted ${entity_type}`, refreshPreview: true, action: 'delete' };
      }
    }
  } catch (e) {
    return { error: e.message };
  }
}

/**
 * Generate plugin code (placeholder - would call existing plugin generation)
 */
async function generatePluginCode({ description, features }, context) {
  // This would integrate with the existing plugin generation system
  return {
    message: `To generate a plugin for: "${description}", please use the Plugin Builder in the admin panel, or say "create a plugin that ${description}" in the AI Workspace.`,
    features: features || []
  };
}

/**
 * Translate content
 */
async function translateContent({ text, target_language, entity_type, entity_id }, storeId) {
  // Placeholder - would integrate with translation service
  return {
    message: `Translation to ${target_language} requested.`,
    text: text?.substring(0, 100),
    entity_type,
    entity_id,
    note: 'Use Admin → Translations for bulk translation'
  };
}

/**
 * Update order status
 */
async function updateOrderStatus({ order_id, status, payment_status, fulfillment_status, tracking_number, notes }, storeId) {
  if (!storeId) return { error: 'No store selected' };
  if (!order_id) return { error: 'Order ID is required' };

  try {
    const db = await ConnectionManager.getStoreConnection(storeId);

    // Find the order by ID or order number
    let query = db.from('orders').select('id, order_number, status, payment_status, fulfillment_status');

    // Check if it's a UUID or order number
    if (order_id.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
      query = query.eq('id', order_id);
    } else {
      query = query.eq('order_number', order_id);
    }

    const { data: order, error: findError } = await query.single();

    if (findError || !order) {
      return { error: `Order not found: ${order_id}` };
    }

    // Build update object with only provided fields
    const updateData = {
      updated_at: new Date().toISOString()
    };

    if (status) updateData.status = status;
    if (payment_status) updateData.payment_status = payment_status;
    if (fulfillment_status) updateData.fulfillment_status = fulfillment_status;
    if (tracking_number) updateData.tracking_number = tracking_number;
    if (notes) updateData.admin_notes = notes;

    // Perform the update
    const { error: updateError } = await db
      .from('orders')
      .update(updateData)
      .eq('id', order.id);

    if (updateError) {
      return { error: updateError.message };
    }

    // Build response message
    const changes = [];
    if (status) changes.push(`status → ${status}`);
    if (payment_status) changes.push(`payment → ${payment_status}`);
    if (fulfillment_status) changes.push(`fulfillment → ${fulfillment_status}`);
    if (tracking_number) changes.push(`tracking: ${tracking_number}`);

    return {
      success: true,
      message: `Order ${order.order_number || order.id} updated: ${changes.join(', ')}`,
      order_id: order.id,
      order_number: order.order_number,
      changes: updateData,
      refreshPreview: true,
      action: 'update'
    };
  } catch (e) {
    return { error: e.message };
  }
}

/**
 * Main chat function - unified entry point
 */
async function chat({ message, conversationHistory = [], storeId, userId, mode = 'general' }) {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('🤖 UNIFIED AI CHAT');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('📝 Message:', message?.substring(0, 100));
  console.log('🏪 Store:', storeId);
  console.log('🎯 Mode:', mode);

  // Build messages
  const messages = [];

  // Add history (last 10)
  for (const msg of conversationHistory.slice(-10)) {
    if (msg.role === 'user' || msg.role === 'assistant') {
      messages.push({
        role: msg.role,
        content: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content)
      });
    }
  }

  messages.push({ role: 'user', content: message });

  // Call Anthropic with tools
  let response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4096,
    system: SYSTEM_PROMPT,
    tools: TOOLS,
    messages
  });

  const toolCalls = [];
  let totalTokens = {
    input: response.usage?.input_tokens || 0,
    output: response.usage?.output_tokens || 0
  };

  // Handle tool use loop
  while (response.stop_reason === 'tool_use') {
    const toolUseBlocks = response.content.filter(b => b.type === 'tool_use');
    const toolResults = [];

    for (const tool of toolUseBlocks) {
      const result = await executeTool(tool.name, tool.input, { storeId, userId });
      toolCalls.push({ name: tool.name, input: tool.input, result });
      toolResults.push({
        type: 'tool_result',
        tool_use_id: tool.id,
        content: JSON.stringify(result)
      });
    }

    // Continue conversation
    messages.push({ role: 'assistant', content: response.content });
    messages.push({ role: 'user', content: toolResults });

    response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      tools: TOOLS,
      messages
    });

    totalTokens.input += response.usage?.input_tokens || 0;
    totalTokens.output += response.usage?.output_tokens || 0;
  }

  // Extract final text
  const textBlocks = response.content.filter(b => b.type === 'text');
  const finalMessage = textBlocks.map(b => b.text).join('\n');

  // Calculate credits
  const credits = Math.ceil((totalTokens.input * 3 + totalTokens.output * 15) / 1000);

  console.log('✅ Complete:', { tools: toolCalls.length, tokens: totalTokens, credits });

  // Determine if refresh is needed
  const needsRefresh = toolCalls.some(t =>
    t.result?.refreshPreview ||
    t.result?.refreshRequired ||
    ['modify_slot', 'update_store_setting', 'update_order_status', 'manage_entity'].includes(t.name)
  );

  console.log('🔄 Refresh needed:', needsRefresh, 'Tool calls:', toolCalls.map(t => ({ name: t.name, refreshPreview: t.result?.refreshPreview })));

  return {
    success: true,
    message: finalMessage,
    data: {
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
      refreshPreview: needsRefresh,
      usage: totalTokens
    },
    creditsDeducted: credits
  };
}

module.exports = {
  chat,
  TOOLS,
  executeTool
};
