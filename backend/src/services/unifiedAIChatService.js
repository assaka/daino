/**
 * Unified AI Chat Service
 *
 * THE SINGLE AI CHAT SERVICE for all modes:
 * - AdminAssistantPanel
 * - AI Workspace
 * - Plugin development
 *
 * Features:
 * - Full RAG from ai_* tables
 * - Learned examples from training data
 * - Smart entity tools (find by name, update by name)
 * - Product management (stock, price, status)
 * - Category management (visibility, hierarchy)
 * - Attribute management (create with values)
 * - Order management
 * - Store settings
 * - Slot/layout editing
 *
 * Uses Anthropic's tool_use API for dynamic, intelligent responses.
 */

const Anthropic = require('@anthropic-ai/sdk');
const { masterDbClient } = require('../database/masterConnection');
const ConnectionManager = require('./database/ConnectionManager');
const aiContextService = require('./aiContextService');
const aiLearningService = require('./aiLearningService');

const anthropic = new Anthropic();

/**
 * Tool definitions - Smart tools that find entities by name
 */
const TOOLS = [
  // ═══════════════════════════════════════════════════════════════
  // KNOWLEDGE & CONTEXT
  // ═══════════════════════════════════════════════════════════════
  {
    name: "search_knowledge",
    description: "Search the platform knowledge base for documentation, guides, and how-to information about credits, pricing, models, translations, slots, plugins, settings, architecture, features.",
    input_schema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Search query"
        }
      },
      required: ["query"]
    }
  },

  // ═══════════════════════════════════════════════════════════════
  // PRODUCT TOOLS - Smart find by name/SKU
  // ═══════════════════════════════════════════════════════════════
  {
    name: "list_products",
    description: "List products with optional filters. Returns id, sku, name, price, stock, status.",
    input_schema: {
      type: "object",
      properties: {
        filter: {
          type: "string",
          enum: ["all", "in_stock", "out_of_stock", "low_stock", "featured", "on_sale"],
          description: "Filter products"
        },
        search: {
          type: "string",
          description: "Search by name or SKU"
        },
        limit: {
          type: "number",
          description: "Max results (default 20)"
        }
      }
    }
  },
  {
    name: "update_product",
    description: "Update a product by name or SKU. Can update: price, stock_quantity, status, featured, compare_price (sale price).",
    input_schema: {
      type: "object",
      properties: {
        product: {
          type: "string",
          description: "Product name or SKU to find"
        },
        updates: {
          type: "object",
          description: "Fields to update: { price, stock_quantity, status, featured, compare_price }",
          properties: {
            price: { type: "number" },
            stock_quantity: { type: "number" },
            status: { type: "string", enum: ["active", "draft", "archived"] },
            featured: { type: "boolean" },
            compare_price: { type: "number" }
          }
        }
      },
      required: ["product", "updates"]
    }
  },
  {
    name: "create_product",
    description: "Create a new product with name, price, and optional fields.",
    input_schema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Product name" },
        sku: { type: "string", description: "SKU (auto-generated if not provided)" },
        price: { type: "number", description: "Price" },
        stock_quantity: { type: "number", description: "Initial stock (default 0)" },
        description: { type: "string", description: "Product description" },
        status: { type: "string", enum: ["active", "draft"], description: "Status (default draft)" }
      },
      required: ["name", "price"]
    }
  },
  {
    name: "delete_product",
    description: "Delete a product by name or SKU.",
    input_schema: {
      type: "object",
      properties: {
        product: { type: "string", description: "Product name or SKU to delete" }
      },
      required: ["product"]
    }
  },

  // ═══════════════════════════════════════════════════════════════
  // CATEGORY TOOLS - Smart find by name, visibility control
  // ═══════════════════════════════════════════════════════════════
  {
    name: "list_categories",
    description: "List all categories with id, name/slug, product count, and visibility status.",
    input_schema: {
      type: "object",
      properties: {
        include_hidden: {
          type: "boolean",
          description: "Include hidden categories (default true)"
        }
      }
    }
  },
  {
    name: "update_category",
    description: "Update a category by name or slug. Can set visibility (is_active, hide_in_menu), sort_order.",
    input_schema: {
      type: "object",
      properties: {
        category: {
          type: "string",
          description: "Category name or slug to find"
        },
        updates: {
          type: "object",
          description: "Fields to update",
          properties: {
            is_active: { type: "boolean", description: "Category active/visible" },
            hide_in_menu: { type: "boolean", description: "Hide from navigation menu" },
            sort_order: { type: "number", description: "Display order" }
          }
        }
      },
      required: ["category", "updates"]
    }
  },
  {
    name: "set_category_visible",
    description: "Make a category visible (is_active=true, hide_in_menu=false). Find by name or slug.",
    input_schema: {
      type: "object",
      properties: {
        category: { type: "string", description: "Category name or slug" }
      },
      required: ["category"]
    }
  },
  {
    name: "set_category_hidden",
    description: "Hide a category (is_active=false, hide_in_menu=true). Find by name or slug.",
    input_schema: {
      type: "object",
      properties: {
        category: { type: "string", description: "Category name or slug" }
      },
      required: ["category"]
    }
  },
  {
    name: "create_category",
    description: "Create a new category.",
    input_schema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Category name" },
        slug: { type: "string", description: "URL slug (auto-generated if not provided)" },
        parent_id: { type: "string", description: "Parent category ID for subcategory" }
      },
      required: ["name"]
    }
  },
  {
    name: "delete_category",
    description: "Delete a category by name or slug.",
    input_schema: {
      type: "object",
      properties: {
        category: { type: "string", description: "Category name or slug to delete" }
      },
      required: ["category"]
    }
  },
  {
    name: "add_product_to_category",
    description: "Add a product to a category. Find both by name.",
    input_schema: {
      type: "object",
      properties: {
        product: { type: "string", description: "Product name or SKU" },
        category: { type: "string", description: "Category name or slug" }
      },
      required: ["product", "category"]
    }
  },
  {
    name: "remove_product_from_category",
    description: "Remove a product from a category. Find both by name.",
    input_schema: {
      type: "object",
      properties: {
        product: { type: "string", description: "Product name or SKU" },
        category: { type: "string", description: "Category name or slug" }
      },
      required: ["product", "category"]
    }
  },

  // ═══════════════════════════════════════════════════════════════
  // ATTRIBUTE TOOLS
  // ═══════════════════════════════════════════════════════════════
  {
    name: "list_attributes",
    description: "List all product attributes with their values.",
    input_schema: {
      type: "object",
      properties: {}
    }
  },
  {
    name: "create_attribute",
    description: "Create a new product attribute (e.g., Color, Size) with optional values.",
    input_schema: {
      type: "object",
      properties: {
        code: { type: "string", description: "Attribute code (e.g., 'color', 'size')" },
        name: { type: "string", description: "Display name (e.g., 'Color', 'Size')" },
        type: { type: "string", enum: ["select", "multiselect", "text", "number", "boolean"], description: "Attribute type" },
        values: {
          type: "array",
          items: { type: "string" },
          description: "Predefined values for select/multiselect (e.g., ['Red', 'Blue', 'Green'])"
        }
      },
      required: ["code", "name", "type"]
    }
  },
  {
    name: "delete_attribute",
    description: "Delete an attribute by code.",
    input_schema: {
      type: "object",
      properties: {
        code: { type: "string", description: "Attribute code to delete" }
      },
      required: ["code"]
    }
  },

  // ═══════════════════════════════════════════════════════════════
  // ORDER TOOLS
  // ═══════════════════════════════════════════════════════════════
  {
    name: "list_orders",
    description: "List orders with optional filters.",
    input_schema: {
      type: "object",
      properties: {
        status: { type: "string", enum: ["pending", "processing", "completed", "cancelled", "refunded"] },
        limit: { type: "number", description: "Max results (default 20)" }
      }
    }
  },
  {
    name: "update_order_status",
    description: "Update order status, payment status, or fulfillment status.",
    input_schema: {
      type: "object",
      properties: {
        order_id: { type: "string", description: "Order ID or order number" },
        status: { type: "string", enum: ["pending", "processing", "completed", "cancelled", "refunded", "on_hold"] },
        payment_status: { type: "string", enum: ["pending", "paid", "failed", "refunded", "partially_refunded"] },
        fulfillment_status: { type: "string", enum: ["unfulfilled", "partially_fulfilled", "fulfilled", "shipped", "delivered", "returned"] },
        tracking_number: { type: "string" },
        notes: { type: "string" }
      },
      required: ["order_id"]
    }
  },

  // ═══════════════════════════════════════════════════════════════
  // CUSTOMER TOOLS
  // ═══════════════════════════════════════════════════════════════
  {
    name: "list_customers",
    description: "List customers with optional search.",
    input_schema: {
      type: "object",
      properties: {
        search: { type: "string", description: "Search by email or name" },
        limit: { type: "number" }
      }
    }
  },

  // ═══════════════════════════════════════════════════════════════
  // COUPON TOOLS
  // ═══════════════════════════════════════════════════════════════
  {
    name: "list_coupons",
    description: "List all discount coupons.",
    input_schema: {
      type: "object",
      properties: {}
    }
  },
  {
    name: "create_coupon",
    description: "Create a discount coupon.",
    input_schema: {
      type: "object",
      properties: {
        code: { type: "string", description: "Coupon code" },
        discount_type: { type: "string", enum: ["percentage", "fixed"], description: "Discount type" },
        discount_value: { type: "number", description: "Discount amount (percentage or fixed)" },
        min_order_amount: { type: "number", description: "Minimum order amount" },
        max_uses: { type: "number", description: "Maximum uses (null for unlimited)" },
        expires_at: { type: "string", description: "Expiration date (ISO format)" }
      },
      required: ["code", "discount_type", "discount_value"]
    }
  },
  {
    name: "delete_coupon",
    description: "Delete a coupon by code.",
    input_schema: {
      type: "object",
      properties: {
        code: { type: "string", description: "Coupon code to delete" }
      },
      required: ["code"]
    }
  },

  // ═══════════════════════════════════════════════════════════════
  // STORE SETTINGS
  // ═══════════════════════════════════════════════════════════════
  {
    name: "get_store_settings",
    description: "Get store configuration.",
    input_schema: {
      type: "object",
      properties: {
        area: { type: "string", enum: ["theme", "display", "payments", "shipping", "all"] }
      },
      required: ["area"]
    }
  },
  {
    name: "update_store_setting",
    description: "Update a store setting.",
    input_schema: {
      type: "object",
      properties: {
        setting_path: { type: "string", description: "Setting path like 'theme.primaryColor'" },
        value: { description: "New value" }
      },
      required: ["setting_path", "value"]
    }
  },

  // ═══════════════════════════════════════════════════════════════
  // SLOT/LAYOUT EDITING
  // ═══════════════════════════════════════════════════════════════
  {
    name: "modify_slot",
    description: "Modify page layout - style slots, show/hide elements.",
    input_schema: {
      type: "object",
      properties: {
        page_type: { type: "string", enum: ["product", "category", "cart", "checkout", "homepage", "header"] },
        slot_id: { type: "string", description: "Slot to modify" },
        action: { type: "string", enum: ["style", "show", "hide", "move"] },
        styles: { type: "object", description: "CSS styles for style action" }
      },
      required: ["page_type", "slot_id", "action"]
    }
  },

  // ═══════════════════════════════════════════════════════════════
  // TRANSLATION
  // ═══════════════════════════════════════════════════════════════
  {
    name: "translate_content",
    description: "Translate content to another language.",
    input_schema: {
      type: "object",
      properties: {
        text: { type: "string", description: "Text to translate" },
        target_language: { type: "string", description: "Target language code (de, fr, nl, es, etc.)" },
        entity_type: { type: "string", description: "Optional: product, category, cms_page" },
        entity_id: { type: "string", description: "Optional: ID of entity to translate" }
      },
      required: ["target_language"]
    }
  },

  // ═══════════════════════════════════════════════════════════════
  // STORE DATA QUERIES
  // ═══════════════════════════════════════════════════════════════
  {
    name: "get_store_stats",
    description: "Get store statistics: product count, order count, revenue, customer count.",
    input_schema: {
      type: "object",
      properties: {
        period: { type: "string", enum: ["today", "week", "month", "year", "all"] }
      }
    }
  }
];

/**
 * Build system prompt with RAG context
 */
async function buildSystemPrompt(storeId, message) {
  let ragContext = '';
  let learnedExamples = '';

  // Fetch RAG context from ai_context_documents
  try {
    const context = await aiContextService.getContextForQuery({
      mode: 'all',
      category: null,
      query: message,
      storeId,
      limit: 5
    });
    if (context) {
      ragContext = context;
    }
  } catch (err) {
    console.error('[UnifiedAI] Failed to load RAG context:', err.message);
  }

  // Fetch learned examples from training data
  try {
    const examples = await aiLearningService.getLearnedExamplesForPrompt();
    if (examples) {
      learnedExamples = examples;
    }
  } catch (err) {
    console.error('[UnifiedAI] Failed to load learned examples:', err.message);
  }

  return `You are the AI assistant for DainoStore, a visual e-commerce platform.

You have DIRECT DATABASE ACCESS through tools. You EXECUTE actions, not explain them.

AVAILABLE TOOLS:
- **Products**: list_products, update_product, create_product, delete_product
- **Categories**: list_categories, update_category, set_category_visible, set_category_hidden, create_category, delete_category, add_product_to_category, remove_product_from_category
- **Attributes**: list_attributes, create_attribute, delete_attribute
- **Orders**: list_orders, update_order_status
- **Customers**: list_customers
- **Coupons**: list_coupons, create_coupon, delete_coupon
- **Settings**: get_store_settings, update_store_setting
- **Layout**: modify_slot
- **Knowledge**: search_knowledge
- **Stats**: get_store_stats
- **Translation**: translate_content

RULES:
1. USE TOOLS for actionable requests - don't just explain
2. When updating entities, find them by name/SKU first
3. Be concise and confirm actions taken
4. If a tool returns an error (e.g., "Product not found"), TELL THE USER clearly what went wrong and suggest solutions (e.g., "I couldn't find a product with SKU 'xyz'. Try using list_products to see available products.")
5. NEVER say "technical issues" or generic errors - always explain the specific problem
4. If something fails, explain why

${ragContext ? `\nPLATFORM KNOWLEDGE:\n${ragContext}\n` : ''}
${learnedExamples ? `\nLEARNED PATTERNS:\n${learnedExamples}\n` : ''}`;
}

// ═══════════════════════════════════════════════════════════════════════════
// TOOL IMPLEMENTATIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Execute a tool
 */
async function executeTool(name, input, context) {
  const { storeId, userId } = context;
  console.log(`🔧 Tool: ${name}`, JSON.stringify(input).substring(0, 200));
  console.log(`   Store ID: ${storeId}`);

  try {
    let result;
    switch (name) {
      case 'search_knowledge':
        result = await searchKnowledge(input.query);
        break;

      // Product tools
      case 'list_products':
        result = await listProducts(input, storeId);
        break;
      case 'update_product':
        result = await updateProduct(input, storeId);
        break;
      case 'create_product':
        result = await createProduct(input, storeId);
        break;
      case 'delete_product':
        result = await deleteProduct(input, storeId);
        break;

      // Category tools
      case 'list_categories':
        result = await listCategories(input, storeId);
        break;
      case 'update_category':
        result = await updateCategory(input, storeId);
        break;
      case 'set_category_visible':
        result = await setCategoryVisibility(input.category, true, storeId);
        break;
      case 'set_category_hidden':
        result = await setCategoryVisibility(input.category, false, storeId);
        break;
      case 'create_category':
        result = await createCategory(input, storeId);
        break;
      case 'delete_category':
        result = await deleteCategory(input, storeId);
        break;
      case 'add_product_to_category':
        result = await addProductToCategory(input, storeId);
        break;
      case 'remove_product_from_category':
        result = await removeProductFromCategory(input, storeId);
        break;

      // Attribute tools
      case 'list_attributes':
        result = await listAttributes(storeId);
        break;
      case 'create_attribute':
        result = await createAttribute(input, storeId);
        break;
      case 'delete_attribute':
        result = await deleteAttribute(input, storeId);
        break;

      // Order tools
      case 'list_orders':
        result = await listOrders(input, storeId);
        break;
      case 'update_order_status':
        result = await updateOrderStatus(input, storeId);
        break;

      // Customer tools
      case 'list_customers':
        result = await listCustomers(input, storeId);
        break;

      // Coupon tools
      case 'list_coupons':
        result = await listCoupons(storeId);
        break;
      case 'create_coupon':
        result = await createCoupon(input, storeId);
        break;
      case 'delete_coupon':
        result = await deleteCoupon(input, storeId);
        break;

      // Settings tools
      case 'get_store_settings':
        result = await getStoreSettings(input.area, storeId);
        break;
      case 'update_store_setting':
        result = await updateStoreSetting(input.setting_path, input.value, storeId);
        break;

      // Layout tools
      case 'modify_slot':
        result = await modifySlot(input, storeId);
        break;

      // Other tools
      case 'translate_content':
        result = await translateContent(input, storeId);
        break;
      case 'get_store_stats':
        result = await getStoreStats(input, storeId);
        break;

      default:
        result = { error: `Unknown tool: ${name}` };
    }

    // Log result
    if (result?.error) {
      console.log(`   ❌ Result: ERROR - ${result.error}`);
    } else if (result?.success) {
      console.log(`   ✅ Result: ${result.message || 'Success'}`);
    } else {
      console.log(`   📦 Result:`, JSON.stringify(result).substring(0, 200));
    }

    return result;
  } catch (err) {
    console.error(`❌ Tool ${name} EXCEPTION:`, err);
    return { error: err.message };
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// HELPER: Find entities by name
// ═══════════════════════════════════════════════════════════════════════════

async function findProductByNameOrSku(db, search) {
  const searchLower = search.toLowerCase();
  console.log('   [findProduct] Searching for:', searchLower);

  // Try SKU first (exact match)
  let { data: bySku, error: skuError } = await db
    .from('products')
    .select('id, sku, price, stock_quantity, status, featured')
    .ilike('sku', searchLower)
    .limit(1);

  if (skuError) {
    console.log('   [findProduct] SKU exact search error:', skuError.message);
  }

  if (bySku?.[0]) {
    console.log('   [findProduct] Found by SKU exact:', bySku[0].sku);
    const p = bySku[0];
    // Get name from product_translations
    const { data: trans } = await db
      .from('product_translations')
      .select('name')
      .eq('product_id', p.id)
      .eq('language_code', 'en')
      .limit(1);
    return { ...p, name: trans?.[0]?.name || p.sku };
  }

  // Try SKU partial match
  ({ data: bySku, error: skuError } = await db
    .from('products')
    .select('id, sku, price, stock_quantity, status, featured')
    .ilike('sku', `%${searchLower}%`)
    .limit(1));

  if (skuError) {
    console.log('   [findProduct] SKU partial search error:', skuError.message);
  }

  if (bySku?.[0]) {
    console.log('   [findProduct] Found by SKU partial:', bySku[0].sku);
    const p = bySku[0];
    // Get name from product_translations
    const { data: trans } = await db
      .from('product_translations')
      .select('name')
      .eq('product_id', p.id)
      .eq('language_code', 'en')
      .limit(1);
    return { ...p, name: trans?.[0]?.name || p.sku };
  }

  // Try name in product_translations
  console.log('   [findProduct] Trying name search in product_translations...');
  const { data: byName, error: nameError } = await db
    .from('product_translations')
    .select('product_id, name')
    .ilike('name', `%${searchLower}%`)
    .eq('language_code', 'en')
    .limit(1);

  if (nameError) {
    console.log('   [findProduct] Name search error:', nameError.message);
  }

  if (byName?.[0]) {
    // Get full product data
    const { data: product } = await db
      .from('products')
      .select('id, sku, price, stock_quantity, status, featured')
      .eq('id', byName[0].product_id)
      .single();
    if (product) {
      console.log('   [findProduct] Found by name:', product.sku);
      return { ...product, name: byName[0].name };
    }
  }

  console.log('   [findProduct] NOT FOUND');
  return null;
}

async function findCategoryByNameOrSlug(db, search) {
  const searchLower = search.toLowerCase();

  // Try slug first
  let { data: bySlug } = await db
    .from('categories')
    .select('id, slug, is_active, hide_in_menu, product_count')
    .ilike('slug', searchLower)
    .limit(1);

  if (bySlug?.[0]) {
    const c = bySlug[0];
    // Get translation
    const { data: trans } = await db
      .from('category_translations')
      .select('name')
      .eq('category_id', c.id)
      .eq('language_code', 'en')
      .limit(1);
    return { ...c, name: trans?.[0]?.name || c.slug };
  }

  // Try slug partial match
  ({ data: bySlug } = await db
    .from('categories')
    .select('id, slug, is_active, hide_in_menu, product_count')
    .ilike('slug', `%${searchLower}%`)
    .limit(1));

  if (bySlug?.[0]) {
    const c = bySlug[0];
    const { data: trans } = await db
      .from('category_translations')
      .select('name')
      .eq('category_id', c.id)
      .eq('language_code', 'en')
      .limit(1);
    return { ...c, name: trans?.[0]?.name || c.slug };
  }

  // Try name in translations
  const { data: translations } = await db
    .from('category_translations')
    .select('category_id, name')
    .ilike('name', `%${searchLower}%`)
    .limit(1);

  if (translations?.[0]) {
    const { data: cat } = await db
      .from('categories')
      .select('id, slug, is_active, hide_in_menu, product_count')
      .eq('id', translations[0].category_id)
      .single();
    if (cat) {
      return { ...cat, name: translations[0].name };
    }
  }

  return null;
}

// ═══════════════════════════════════════════════════════════════════════════
// KNOWLEDGE
// ═══════════════════════════════════════════════════════════════════════════

async function searchKnowledge(query) {
  try {
    const context = await aiContextService.getContextForQuery({
      mode: 'all',
      query,
      limit: 5
    });

    if (context) {
      return { found: true, content: context };
    }

    // Fallback to basic search
    const searchTerms = query.toLowerCase().split(' ').filter(t => t.length > 2);
    const { data: docs } = await masterDbClient
      .from('ai_context_documents')
      .select('title, content, category')
      .eq('is_active', true)
      .order('priority', { ascending: false })
      .limit(10);

    const matches = (docs || []).filter(doc => {
      const text = `${doc.title} ${doc.content} ${doc.category}`.toLowerCase();
      return searchTerms.some(term => text.includes(term));
    });

    if (matches.length > 0) {
      return { found: true, results: matches.slice(0, 5) };
    }

    return { found: false, message: `No documentation found for "${query}"` };
  } catch (e) {
    return { found: false, error: e.message };
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// PRODUCT TOOLS
// ═══════════════════════════════════════════════════════════════════════════

async function listProducts({ filter, search, limit = 20 }, storeId) {
  const db = await ConnectionManager.getStoreConnection(storeId);

  let query = db.from('products')
    .select('id, sku, price, compare_price, stock_quantity, low_stock_threshold, status, featured')
    .limit(limit);

  if (filter === 'in_stock') query = query.gt('stock_quantity', 0);
  if (filter === 'out_of_stock') query = query.lte('stock_quantity', 0);
  if (filter === 'low_stock') query = query.lt('stock_quantity', 5);
  if (filter === 'featured') query = query.eq('featured', true);

  const { data, error } = await query;
  if (error) return { error: error.message };

  // Get names from product_translations
  const productIds = (data || []).map(p => p.id);
  const { data: translations } = await db
    .from('product_translations')
    .select('product_id, name')
    .in('product_id', productIds)
    .eq('language_code', 'en');

  const nameMap = new Map(translations?.map(t => [t.product_id, t.name]) || []);

  let products = (data || []).map(p => ({
    id: p.id,
    sku: p.sku,
    name: nameMap.get(p.id) || p.sku,
    price: p.price,
    compare_price: p.compare_price,
    stock: p.stock_quantity,
    status: p.status,
    featured: p.featured,
    on_sale: p.compare_price && p.compare_price > p.price
  }));

  if (search) {
    const searchLower = search.toLowerCase();
    products = products.filter(p =>
      p.name.toLowerCase().includes(searchLower) ||
      p.sku.toLowerCase().includes(searchLower)
    );
  }

  return {
    count: products.length,
    products: products.slice(0, limit)
  };
}

async function updateProduct({ product, updates }, storeId) {
  console.log('   [updateProduct] Starting...', { product, updates, storeId });

  const db = await ConnectionManager.getStoreConnection(storeId);
  console.log('   [updateProduct] Got DB connection');

  const found = await findProductByNameOrSku(db, product);
  console.log('   [updateProduct] Find result:', found ? { id: found.id, sku: found.sku } : 'NOT FOUND');

  if (!found) {
    return { error: `Product "${product}" not found` };
  }

  const { error } = await db
    .from('products')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', found.id);

  if (error) {
    console.log('   [updateProduct] Update error:', error);
    return { error: error.message };
  }

  const changes = Object.entries(updates).map(([k, v]) => `${k}=${v}`).join(', ');
  console.log('   [updateProduct] Success:', changes);

  return {
    success: true,
    message: `Updated "${found.name}" (${found.sku}): ${changes}`,
    product: { id: found.id, sku: found.sku, name: found.name },
    refreshPreview: true,
    action: 'update'
  };
}

async function createProduct({ name, sku, price, stock_quantity = 0, description, status = 'draft' }, storeId) {
  const db = await ConnectionManager.getStoreConnection(storeId);

  const generatedSku = sku || name.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 50);

  // Insert product
  const { data: created, error } = await db
    .from('products')
    .insert({
      sku: generatedSku,
      price,
      stock_quantity,
      status
    })
    .select('id, sku')
    .single();

  if (error) return { error: error.message };

  // Insert translation
  await db.from('product_translations').insert({
    product_id: created.id,
    language_code: 'en',
    name,
    description: description || ''
  });

  return {
    success: true,
    message: `Created product "${name}" (${generatedSku}) - $${price}`,
    product: { id: created.id, sku: created.sku, name },
    refreshPreview: true,
    action: 'create'
  };
}

async function deleteProduct({ product }, storeId) {
  const db = await ConnectionManager.getStoreConnection(storeId);

  const found = await findProductByNameOrSku(db, product);
  if (!found) {
    return { error: `Product "${product}" not found` };
  }

  const { error } = await db.from('products').delete().eq('id', found.id);
  if (error) return { error: error.message };

  return {
    success: true,
    message: `Deleted product "${found.name}" (${found.sku})`,
    refreshPreview: true,
    action: 'delete'
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// CATEGORY TOOLS
// ═══════════════════════════════════════════════════════════════════════════

async function listCategories({ include_hidden = true }, storeId) {
  const db = await ConnectionManager.getStoreConnection(storeId);

  let query = db.from('categories')
    .select('id, slug, is_active, hide_in_menu, product_count, sort_order')
    .order('sort_order');

  if (!include_hidden) {
    query = query.eq('is_active', true).eq('hide_in_menu', false);
  }

  const { data: categories, error } = await query.limit(50);
  if (error) return { error: error.message };

  // Get translations
  const catIds = (categories || []).map(c => c.id);
  const { data: translations } = await db
    .from('category_translations')
    .select('category_id, name')
    .in('category_id', catIds)
    .eq('language_code', 'en');

  const transMap = new Map(translations?.map(t => [t.category_id, t.name]) || []);

  return {
    count: categories?.length || 0,
    categories: (categories || []).map(c => ({
      id: c.id,
      slug: c.slug,
      name: transMap.get(c.id) || c.slug,
      product_count: c.product_count || 0,
      is_active: c.is_active,
      hide_in_menu: c.hide_in_menu,
      visible: c.is_active && !c.hide_in_menu
    }))
  };
}

async function updateCategory({ category, updates }, storeId) {
  const db = await ConnectionManager.getStoreConnection(storeId);

  const found = await findCategoryByNameOrSlug(db, category);
  if (!found) {
    return { error: `Category "${category}" not found` };
  }

  const { error } = await db
    .from('categories')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', found.id);

  if (error) return { error: error.message };

  const changes = Object.entries(updates).map(([k, v]) => `${k}=${v}`).join(', ');
  return {
    success: true,
    message: `Updated category "${found.name}": ${changes}`,
    category: { id: found.id, slug: found.slug, name: found.name },
    refreshPreview: true,
    action: 'update'
  };
}

async function setCategoryVisibility(category, visible, storeId) {
  const db = await ConnectionManager.getStoreConnection(storeId);

  const found = await findCategoryByNameOrSlug(db, category);
  if (!found) {
    return { error: `Category "${category}" not found` };
  }

  const { error } = await db
    .from('categories')
    .update({
      is_active: visible,
      hide_in_menu: !visible,
      updated_at: new Date().toISOString()
    })
    .eq('id', found.id);

  if (error) return { error: error.message };

  return {
    success: true,
    message: `Category "${found.name}" is now ${visible ? 'visible' : 'hidden'}`,
    category: { id: found.id, slug: found.slug, name: found.name, visible },
    refreshPreview: true,
    action: 'update'
  };
}

async function createCategory({ name, slug, parent_id }, storeId) {
  const db = await ConnectionManager.getStoreConnection(storeId);

  const generatedSlug = slug || name.toLowerCase().replace(/[^a-z0-9]+/g, '-');

  const { data: created, error } = await db
    .from('categories')
    .insert({
      slug: generatedSlug,
      parent_id: parent_id || null,
      is_active: true,
      hide_in_menu: false,
      sort_order: 0,
      level: parent_id ? 1 : 0
    })
    .select('id')
    .single();

  if (error) return { error: error.message };

  // Add translation
  await db.from('category_translations').insert({
    category_id: created.id,
    language_code: 'en',
    name
  });

  return {
    success: true,
    message: `Created category "${name}"`,
    category: { id: created.id, slug: generatedSlug, name },
    refreshPreview: true,
    action: 'create'
  };
}

async function deleteCategory({ category }, storeId) {
  const db = await ConnectionManager.getStoreConnection(storeId);

  const found = await findCategoryByNameOrSlug(db, category);
  if (!found) {
    return { error: `Category "${category}" not found` };
  }

  // Delete translations first
  await db.from('category_translations').delete().eq('category_id', found.id);
  const { error } = await db.from('categories').delete().eq('id', found.id);

  if (error) return { error: error.message };

  return {
    success: true,
    message: `Deleted category "${found.name}"`,
    refreshPreview: true,
    action: 'delete'
  };
}

async function addProductToCategory({ product, category }, storeId) {
  const db = await ConnectionManager.getStoreConnection(storeId);

  const foundProduct = await findProductByNameOrSku(db, product);
  if (!foundProduct) return { error: `Product "${product}" not found` };

  const foundCategory = await findCategoryByNameOrSlug(db, category);
  if (!foundCategory) return { error: `Category "${category}" not found` };

  // Get current category_ids
  const { data: productData } = await db
    .from('products')
    .select('category_ids')
    .eq('id', foundProduct.id)
    .single();

  const currentIds = productData?.category_ids || [];
  if (currentIds.includes(foundCategory.id)) {
    return { message: `"${foundProduct.name}" is already in "${foundCategory.name}"` };
  }

  const { error } = await db
    .from('products')
    .update({ category_ids: [...currentIds, foundCategory.id] })
    .eq('id', foundProduct.id);

  if (error) return { error: error.message };

  return {
    success: true,
    message: `Added "${foundProduct.name}" to "${foundCategory.name}"`,
    refreshPreview: true,
    action: 'update'
  };
}

async function removeProductFromCategory({ product, category }, storeId) {
  const db = await ConnectionManager.getStoreConnection(storeId);

  const foundProduct = await findProductByNameOrSku(db, product);
  if (!foundProduct) return { error: `Product "${product}" not found` };

  const foundCategory = await findCategoryByNameOrSlug(db, category);
  if (!foundCategory) return { error: `Category "${category}" not found` };

  const { data: productData } = await db
    .from('products')
    .select('category_ids')
    .eq('id', foundProduct.id)
    .single();

  const currentIds = productData?.category_ids || [];
  const newIds = currentIds.filter(id => id !== foundCategory.id);

  const { error } = await db
    .from('products')
    .update({ category_ids: newIds })
    .eq('id', foundProduct.id);

  if (error) return { error: error.message };

  return {
    success: true,
    message: `Removed "${foundProduct.name}" from "${foundCategory.name}"`,
    refreshPreview: true,
    action: 'update'
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// ATTRIBUTE TOOLS
// ═══════════════════════════════════════════════════════════════════════════

async function listAttributes(storeId) {
  const db = await ConnectionManager.getStoreConnection(storeId);

  const { data: attributes, error } = await db
    .from('attributes')
    .select('id, code, type, translations, values, is_filterable, is_visible')
    .order('code');

  if (error) return { error: error.message };

  return {
    count: attributes?.length || 0,
    attributes: (attributes || []).map(a => ({
      id: a.id,
      code: a.code,
      name: a.translations?.en?.name || a.code,
      type: a.type,
      values: a.values || [],
      filterable: a.is_filterable,
      visible: a.is_visible
    }))
  };
}

async function createAttribute({ code, name, type, values = [] }, storeId) {
  const db = await ConnectionManager.getStoreConnection(storeId);

  const { data: created, error } = await db
    .from('attributes')
    .insert({
      code: code.toLowerCase().replace(/[^a-z0-9_]/g, '_'),
      type,
      translations: { en: { name } },
      values: values.map((v, i) => ({
        value: v.toLowerCase().replace(/[^a-z0-9_]/g, '_'),
        label: { en: v },
        sort_order: i
      })),
      is_filterable: true,
      is_visible: true
    })
    .select('id, code')
    .single();

  if (error) return { error: error.message };

  return {
    success: true,
    message: `Created attribute "${name}" (${code}) with ${values.length} values: ${values.join(', ')}`,
    attribute: { id: created.id, code: created.code, name, values },
    refreshPreview: true,
    action: 'create'
  };
}

async function deleteAttribute({ code }, storeId) {
  const db = await ConnectionManager.getStoreConnection(storeId);

  const { data: attr } = await db
    .from('attributes')
    .select('id, code')
    .eq('code', code)
    .single();

  if (!attr) return { error: `Attribute "${code}" not found` };

  const { error } = await db.from('attributes').delete().eq('id', attr.id);
  if (error) return { error: error.message };

  return {
    success: true,
    message: `Deleted attribute "${code}"`,
    refreshPreview: true,
    action: 'delete'
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// ORDER TOOLS
// ═══════════════════════════════════════════════════════════════════════════

async function listOrders({ status, limit = 20 }, storeId) {
  const db = await ConnectionManager.getStoreConnection(storeId);

  let query = db.from('orders')
    .select('id, order_number, total, status, payment_status, fulfillment_status, created_at')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (status) query = query.eq('status', status);

  const { data, error } = await query;
  if (error) return { error: error.message };

  return {
    count: data?.length || 0,
    orders: data || []
  };
}

async function updateOrderStatus({ order_id, status, payment_status, fulfillment_status, tracking_number, notes }, storeId) {
  const db = await ConnectionManager.getStoreConnection(storeId);

  // Find order
  let query = db.from('orders').select('id, order_number');
  if (order_id.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
    query = query.eq('id', order_id);
  } else {
    query = query.eq('order_number', order_id);
  }

  const { data: order, error: findError } = await query.single();
  if (findError || !order) return { error: `Order "${order_id}" not found` };

  const updateData = { updated_at: new Date().toISOString() };
  if (status) updateData.status = status;
  if (payment_status) updateData.payment_status = payment_status;
  if (fulfillment_status) updateData.fulfillment_status = fulfillment_status;
  if (tracking_number) updateData.tracking_number = tracking_number;
  if (notes) updateData.admin_notes = notes;

  const { error } = await db.from('orders').update(updateData).eq('id', order.id);
  if (error) return { error: error.message };

  const changes = [];
  if (status) changes.push(`status → ${status}`);
  if (payment_status) changes.push(`payment → ${payment_status}`);
  if (fulfillment_status) changes.push(`fulfillment → ${fulfillment_status}`);

  return {
    success: true,
    message: `Order ${order.order_number || order.id} updated: ${changes.join(', ')}`,
    refreshPreview: true,
    action: 'update'
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// CUSTOMER TOOLS
// ═══════════════════════════════════════════════════════════════════════════

async function listCustomers({ search, limit = 20 }, storeId) {
  const db = await ConnectionManager.getStoreConnection(storeId);

  let query = db.from('customers')
    .select('id, email, first_name, last_name, created_at')
    .limit(limit);

  if (search) {
    query = query.or(`email.ilike.%${search}%,first_name.ilike.%${search}%,last_name.ilike.%${search}%`);
  }

  const { data, error } = await query;
  if (error) return { error: error.message };

  return {
    count: data?.length || 0,
    customers: (data || []).map(c => ({
      id: c.id,
      email: c.email,
      name: `${c.first_name || ''} ${c.last_name || ''}`.trim() || c.email
    }))
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// COUPON TOOLS
// ═══════════════════════════════════════════════════════════════════════════

async function listCoupons(storeId) {
  const db = await ConnectionManager.getStoreConnection(storeId);

  const { data, error } = await db
    .from('coupons')
    .select('id, code, discount_type, discount_value, min_order_amount, max_uses, uses_count, is_active, expires_at')
    .order('created_at', { ascending: false });

  if (error) return { error: error.message };

  return {
    count: data?.length || 0,
    coupons: data || []
  };
}

async function createCoupon({ code, discount_type, discount_value, min_order_amount, max_uses, expires_at }, storeId) {
  const db = await ConnectionManager.getStoreConnection(storeId);

  const { data: created, error } = await db
    .from('coupons')
    .insert({
      code: code.toUpperCase(),
      discount_type,
      discount_value,
      min_order_amount: min_order_amount || 0,
      max_uses: max_uses || null,
      expires_at: expires_at || null,
      is_active: true
    })
    .select('id, code')
    .single();

  if (error) return { error: error.message };

  const discountText = discount_type === 'percentage' ? `${discount_value}%` : `$${discount_value}`;
  return {
    success: true,
    message: `Created coupon "${code}" - ${discountText} off`,
    coupon: created,
    refreshPreview: true,
    action: 'create'
  };
}

async function deleteCoupon({ code }, storeId) {
  const db = await ConnectionManager.getStoreConnection(storeId);

  const { data: coupon } = await db
    .from('coupons')
    .select('id')
    .eq('code', code.toUpperCase())
    .single();

  if (!coupon) return { error: `Coupon "${code}" not found` };

  const { error } = await db.from('coupons').delete().eq('id', coupon.id);
  if (error) return { error: error.message };

  return {
    success: true,
    message: `Deleted coupon "${code}"`,
    refreshPreview: true,
    action: 'delete'
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// SETTINGS TOOLS
// ═══════════════════════════════════════════════════════════════════════════

async function getStoreSettings(area, storeId) {
  const db = await ConnectionManager.getStoreConnection(storeId);

  const { data: store } = await db
    .from('stores')
    .select('settings')
    .eq('id', storeId)
    .single();

  const settings = store?.settings || {};

  if (area === 'all') return { settings };
  return { [area]: settings[area] || {} };
}

async function updateStoreSetting(path, value, storeId) {
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
    message: `Updated ${path} = ${JSON.stringify(value)}`,
    refreshPreview: path.startsWith('theme'),
    action: 'update'
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// SLOT/LAYOUT TOOLS
// ═══════════════════════════════════════════════════════════════════════════

async function modifySlot({ page_type, slot_id, action, styles }, storeId) {
  const db = await ConnectionManager.getStoreConnection(storeId);

  const { data: config } = await db
    .from('slot_configurations')
    .select('*')
    .eq('store_id', storeId)
    .eq('page_type', page_type)
    .eq('is_draft', true)
    .single();

  if (!config) return { error: `No draft configuration for ${page_type} page` };

  const configuration = config.configuration || { slots: {} };

  if (!configuration.slots[slot_id]) {
    return { error: `Slot "${slot_id}" not found on ${page_type} page` };
  }

  switch (action) {
    case 'style':
      configuration.slots[slot_id].styles = { ...configuration.slots[slot_id].styles, ...styles };
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
    refreshPreview: true,
    action: 'update'
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// OTHER TOOLS
// ═══════════════════════════════════════════════════════════════════════════

async function translateContent({ text, target_language, entity_type, entity_id }, storeId) {
  return {
    message: `Translation to ${target_language} requested.`,
    text: text?.substring(0, 100),
    note: 'Use Admin → Translations for bulk translation'
  };
}

async function getStoreStats({ period = 'all' }, storeId) {
  const db = await ConnectionManager.getStoreConnection(storeId);

  const { count: productCount } = await db.from('products').select('*', { count: 'exact', head: true });
  const { count: orderCount } = await db.from('orders').select('*', { count: 'exact', head: true });
  const { count: customerCount } = await db.from('customers').select('*', { count: 'exact', head: true });

  const { data: orders } = await db.from('orders').select('total');
  const revenue = (orders || []).reduce((sum, o) => sum + (parseFloat(o.total) || 0), 0);

  return {
    products: productCount || 0,
    orders: orderCount || 0,
    customers: customerCount || 0,
    revenue: revenue.toFixed(2),
    period
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN CHAT FUNCTION
// ═══════════════════════════════════════════════════════════════════════════

async function chat({ message, conversationHistory = [], storeId, userId, mode = 'general', images }) {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('🤖 UNIFIED AI CHAT');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('📝 Message:', message?.substring(0, 100));
  console.log('🏪 Store:', storeId);
  console.log('🎯 Mode:', mode);

  // Build system prompt with RAG
  const systemPrompt = await buildSystemPrompt(storeId, message);

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

  // Add current message with images if present
  if (images && images.length > 0) {
    const content = [
      { type: 'text', text: message || 'Please analyze this image.' },
      ...images.map(img => ({
        type: 'image',
        source: {
          type: 'base64',
          media_type: img.type || 'image/jpeg',
          data: img.base64
        }
      }))
    ];
    messages.push({ role: 'user', content });
  } else {
    messages.push({ role: 'user', content: message });
  }

  // Call Anthropic with tools
  let response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4096,
    system: systemPrompt,
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
      system: systemPrompt,
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
    t.result?.action
  );

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
