// backend/src/routes/ai.js
const express = require('express');
const router = express.Router();
const aiService = require('../services/AIService');
const aiProvider = require('../services/ai-provider-service');
const aiModelsService = require('../services/AIModelsService');
const aiEntityService = require('../services/aiEntityService');
const aiContextService = require('../services/aiContextService');
const aiLearningService = require('../services/aiLearningService');
const aiTrainingService = require('../services/aiTrainingService');
const aiTrainingRoutes = require('./ai-training');
const { authMiddleware } = require('../middleware/authMiddleware');

// Mount training routes
router.use('/training', aiTrainingRoutes);

const AIModel = require('../models/AIModel');

/**
 * GET /api/ai/models
 * Get available AI models from database (only provider defaults for dropdown)
 * Filters: is_provider_default = true, is_active = true, is_visible = true
 */
router.get('/models', async (req, res) => {
  try {
    const models = await AIModel.getProviderDefaults();
    res.json({
      success: true,
      models: models,
      count: models.length
    });
  } catch (error) {
    console.error('Failed to fetch AI models:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch AI models',
      message: error.message
    });
  }
});

/**
 * POST /api/ai/smart-chat
 * Ultimate AI chat combining: RAG + Learned Examples + Real-time Data + Natural Reasoning
 * This is the "wow effect" Claude Code-style approach
 */
router.post('/smart-chat', authMiddleware, async (req, res) => {
  try {
    const { message, history = [], modelId, serviceKey, images } = req.body;
    const userId = req.user?.id;
    const storeId = req.headers['x-store-id'] || req.body.storeId;

    if (!message && (!images || images.length === 0)) {
      return res.status(400).json({ success: false, message: 'message or images required' });
    }

    console.log('🧠 ULTIMATE AI CHAT');
    console.log('📝:', message);
    if (images && images.length > 0) {
      console.log('📷 Images attached:', images.length);
    }

    const ConnectionManager = require('../services/database/ConnectionManager');
    const { masterDbClient } = require('../database/masterConnection');

    // ═══════════════════════════════════════════════════════════════════
    // STEP 1: Load RAG Knowledge Base (store-specific docs + global docs)
    // ═══════════════════════════════════════════════════════════════════
    let knowledgeBase = '';
    try {
      const { data: docs } = await masterDbClient
        .from('ai_context_documents')
        .select('title, content, category')
        .eq('is_active', true)
        .order('priority', { ascending: false })
        .limit(5);

      if (docs?.length) {
        knowledgeBase = docs.map(d => `[${d.category}] ${d.title}: ${d.content?.substring(0, 500)}`).join('\n');
      }
    } catch (e) { console.error('RAG load failed:', e); }

    // ═══════════════════════════════════════════════════════════════════
    // STEP 2: Load Learned Examples (approved successful prompts)
    // ═══════════════════════════════════════════════════════════════════
    let learnedExamples = '';
    try {
      const { data: examples } = await masterDbClient
        .from('ai_training_candidates')
        .select('user_prompt, ai_response, detected_entity, success_count')
        .in('training_status', ['approved', 'promoted'])
        .gt('success_count', 0)
        .order('success_count', { ascending: false })
        .limit(5);

      if (examples?.length) {
        learnedExamples = '\nLEARNED FROM PAST SUCCESS:\n' + examples.map(e =>
          `Q: "${e.user_prompt?.substring(0, 100)}"\nStyle: ${e.detected_entity || 'general'} (worked ${e.success_count}x)`
        ).join('\n');
      }
    } catch (e) { console.error('Examples load failed:', e); }

    // ═══════════════════════════════════════════════════════════════════
    // STEP 2.5: Load Recent Chat History from Database (for context)
    // ═══════════════════════════════════════════════════════════════════
    let dbHistory = [];
    if (storeId) {
      try {
        const tenantDb = await ConnectionManager.getStoreConnection(storeId);
        const { data: recentMessages } = await tenantDb
          .from('ai_chat_sessions')
          .select('role, content, created_at')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(10);

        if (recentMessages?.length) {
          // Reverse to get chronological order (oldest first)
          dbHistory = recentMessages.reverse().map(m => ({
            role: m.role,
            content: m.content
          }));
          console.log('📜 Loaded', dbHistory.length, 'messages from chat history');
        }
      } catch (e) {
        console.error('Chat history load failed:', e.message);
      }
    }

    // Merge DB history with frontend history (prefer DB for context)
    const conversationHistory = dbHistory.length > 0 ? dbHistory : history;

    // ═══════════════════════════════════════════════════════════════════
    // STEP 3: Get Real-time Store Data
    // ═══════════════════════════════════════════════════════════════════
    let storeData = '';
    let queryResults = null;

    if (storeId) {
      try {
        const tenantDb = await ConnectionManager.getStoreConnection(storeId);
        const msg = message.toLowerCase();

        // Smart data fetching based on what user asks
        if (/categor/i.test(msg)) {
          const cats = await tenantDb('categories as c')
            .leftJoin('category_translations as ct', function() {
              this.on('c.id', 'ct.category_id').andOn('ct.language_code', tenantDb.raw('?', ['en']));
            })
            .select('c.id', 'c.slug', 'c.is_active', 'c.level', 'c.parent_id', 'c.product_count', 'ct.name')
            .orderBy('c.level')
            .limit(50);

          const active = cats.filter(c => c.is_active);
          const root = cats.filter(c => !c.parent_id);
          queryResults = { type: 'categories', data: cats, summary: { total: cats.length, active: active.length, root: root.length } };
          storeData = `\n📊 CATEGORIES (${cats.length} total, ${active.length} active):\n` +
            cats.slice(0, 15).map(c => `• ${c.name || c.slug} ${c.is_active ? '✓' : '✗'} (${c.product_count || 0} products)`).join('\n');
        }
        else if (/out.?of.?stock|no.?stock/i.test(msg)) {
          const prods = await tenantDb('products as p')
            .leftJoin('product_translations as pt', function() {
              this.on('p.id', 'pt.product_id').andOn('pt.language_code', tenantDb.raw('?', ['en']));
            })
            .where('p.stock_quantity', '<=', 0)
            .select('p.id', 'p.sku', 'p.stock_quantity', 'p.price', 'pt.name')
            .limit(30);

          queryResults = { type: 'out_of_stock', data: prods, summary: { count: prods.length } };
          storeData = `\n📊 OUT OF STOCK (${prods.length} products):\n` +
            prods.slice(0, 10).map(p => `• ${p.sku}: ${p.name || 'Unnamed'}`).join('\n');
        }
        else if (/products?|inventory/i.test(msg)) {
          const stats = await tenantDb('products')
            .select(
              tenantDb.raw('COUNT(*) as total'),
              tenantDb.raw('SUM(CASE WHEN stock_quantity <= 0 THEN 1 ELSE 0 END) as out_of_stock'),
              tenantDb.raw('SUM(CASE WHEN status = ? THEN 1 ELSE 0 END) as active', ['active'])
            ).first();

          queryResults = { type: 'products', summary: stats };
          storeData = `\n📊 PRODUCTS: ${stats?.total || 0} total, ${stats?.active || 0} active, ${stats?.out_of_stock || 0} out of stock`;
        }
        else if (/orders?|sales/i.test(msg)) {
          const orders = await tenantDb('sales_orders')
            .select('id', 'order_number', 'status', 'total_amount', 'created_at')
            .orderBy('created_at', 'desc')
            .limit(10);

          const stats = await tenantDb('sales_orders')
            .select(
              tenantDb.raw('COUNT(*) as total'),
              tenantDb.raw('SUM(total_amount) as revenue')
            ).first();

          queryResults = { type: 'orders', data: orders, summary: stats };
          storeData = `\n📊 ORDERS: ${stats?.total || 0} total, $${parseFloat(stats?.revenue || 0).toFixed(2)} revenue\n` +
            'Recent:\n' + orders.slice(0, 5).map(o => `• #${o.order_number}: ${o.status} - $${o.total_amount}`).join('\n');
        }
        else if (/attributes?/i.test(msg)) {
          const attrs = await tenantDb('attributes as a')
            .leftJoin('attribute_translations as at', function() {
              this.on('a.id', 'at.attribute_id').andOn('at.language_code', tenantDb.raw('?', ['en']));
            })
            .select('a.id', 'a.code', 'a.type', 'a.is_filterable', 'at.name')
            .limit(30);

          queryResults = { type: 'attributes', data: attrs, summary: { count: attrs.length } };
          storeData = `\n📊 ATTRIBUTES (${attrs.length}):\n` +
            attrs.slice(0, 10).map(a => `• ${a.name || a.code} (${a.type})${a.is_filterable ? ' [filterable]' : ''}`).join('\n');
        }
        else if (/coupons?|discounts?/i.test(msg)) {
          const coupons = await tenantDb('coupons')
            .select('id', 'code', 'discount_type', 'discount_value', 'is_active', 'usage_count')
            .orderBy('created_at', 'desc')
            .limit(20);

          queryResults = { type: 'coupons', data: coupons, summary: { count: coupons.length, active: coupons.filter(c => c.is_active).length } };
          storeData = `\n📊 COUPONS (${coupons.length}, ${coupons.filter(c => c.is_active).length} active):\n` +
            coupons.slice(0, 8).map(c => `• ${c.code}: ${c.discount_value}${c.discount_type === 'percentage' ? '%' : '$'} off ${c.is_active ? '✓' : '✗'}`).join('\n');
        }
        else if (/customers?/i.test(msg)) {
          const stats = await tenantDb('customers')
            .select(tenantDb.raw('COUNT(*) as total')).first();

          queryResults = { type: 'customers', summary: stats };
          storeData = `\n📊 CUSTOMERS: ${stats?.total || 0} registered`;
        }
        else {
          // Get general store overview
          const [prods, cats, orders] = await Promise.all([
            tenantDb('products').count('* as c').first(),
            tenantDb('categories').count('* as c').first(),
            tenantDb('sales_orders').count('* as c').first()
          ]);
          storeData = `\n📊 STORE: ${prods?.c || 0} products, ${cats?.c || 0} categories, ${orders?.c || 0} orders`;
        }
      } catch (e) {
        console.error('Store data fetch failed:', e);
      }
    }

    // ═══════════════════════════════════════════════════════════════════
    // STEP 3.5: Auto-complete styling from conversation context
    // ═══════════════════════════════════════════════════════════════════
    // If user just says an element name after a styling question, execute directly
    const elementMap = {
      'product title': 'product_title', 'title': 'product_title', 'the title': 'product_title',
      'price': 'product_price', 'the price': 'product_price', 'product price': 'product_price',
      'button': 'add_to_cart_button', 'add to cart': 'add_to_cart_button', 'cart button': 'add_to_cart_button',
      'description': 'product_short_description', 'the description': 'product_short_description',
      'sku': 'product_sku', 'stock': 'stock_status', 'breadcrumb': 'breadcrumbs'
    };

    const msgLower = message.toLowerCase().trim();
    const matchedElement = elementMap[msgLower];

    if (matchedElement && conversationHistory.length > 0) {
      // Look back for pending styling info in recent messages
      const recentContent = conversationHistory.slice(-4).map(m => m.content).join(' ').toLowerCase();

      // Extract styling intent from history
      const colorMatch = recentContent.match(/(?:change|set|make).*?(?:color|colour).*?(?:to\s+)?(\w+)/i);
      const sizeMatch = recentContent.match(/(?:make|set).*?(?:bigger|larger|smaller|size).*?(\d+)?/i);
      const boldMatch = recentContent.match(/(?:make|set).*?bold/i);

      if (colorMatch || sizeMatch || boldMatch) {
        console.log('🎯 Auto-completing styling from context:', { element: matchedElement, colorMatch, sizeMatch, boldMatch });

        let toolCall = { tool: 'update_styling', element: matchedElement };

        if (colorMatch) {
          toolCall.property = 'color';
          toolCall.value = colorMatch[1]; // The color value
        } else if (sizeMatch) {
          toolCall.property = 'fontSize';
          toolCall.value = sizeMatch[1] ? `${sizeMatch[1]}px` : '28px';
        } else if (boldMatch) {
          toolCall.property = 'fontWeight';
          toolCall.value = 'bold';
        }

        // Execute directly
        const result = await executeToolAction(toolCall, storeId, userId, message);

        return res.json({
          success: true,
          message: result.message || `Updated ${matchedElement} styling.`,
          data: {
            type: result.data?.type || 'tool_executed',
            tool: 'update_styling',
            result: result.data,
            pageType: result.data?.pageType,
            slotId: result.data?.slotId,
            configId: result.data?.configId,
            refreshPreview: result.data?.refreshPreview
          },
          creditsDeducted: 0
        });
      }
    }

    // ═══════════════════════════════════════════════════════════════════
    // STEP 4: Check for confirmation responses ("yes", "ok", "do it", etc.)
    // ═══════════════════════════════════════════════════════════════════
    const confirmationPatterns = /^(yes|yeah|yep|ok|okay|sure|do it|go ahead|proceed|create it|confirm|please|y)\.?$/i;
    const isConfirmation = confirmationPatterns.test(message.trim());

    // Look for pending action in conversation history
    let pendingAction = null;
    if (isConfirmation && history.length > 0) {
      // Find the last assistant message with a pending action
      for (let i = history.length - 1; i >= 0; i--) {
        if (history[i].role === 'assistant' && history[i].pendingAction) {
          pendingAction = history[i].pendingAction;
          break;
        }
      }
    }

    // ═══════════════════════════════════════════════════════════════════
    // STEP 5: Build Ultimate System Prompt - TOOL-BASED EXECUTION
    // ═══════════════════════════════════════════════════════════════════
    const systemPrompt = `You are an AI assistant for DainoStore with DIRECT DATABASE ACCESS. You EXECUTE actions, not explain them.

YOU HAVE THESE TOOLS - Return JSON to execute them:

═══ CATEGORY TOOLS ═══
TOOL: list_categories - List all categories
Return: {"tool": "list_categories"}

TOOL: create_category - Create a new category
Return: {"tool": "create_category", "name": "category name"}

TOOL: delete_category - Delete a category
Return: {"tool": "delete_category", "name": "category name"}

TOOL: add_to_category - Add product to category
Return: {"tool": "add_to_category", "product": "product name", "category": "category name"}

TOOL: remove_from_category - Remove product from category
Return: {"tool": "remove_from_category", "product": "product name", "category": "category name"}

═══ PRODUCT TOOLS ═══
TOOL: list_products - List/filter products with smart filters
Filters: in_stock, out_of_stock, low_stock, featured, on_sale, category, price_min, price_max, status, sort_by, limit
Sort options: price_asc, price_desc, newest, oldest, best_selling, popular, stock_asc, stock_desc
Examples:
  {"tool": "list_products"} - all products
  {"tool": "list_products", "filters": {"in_stock": true}} - products in stock
  {"tool": "list_products", "filters": {"out_of_stock": true}} - out of stock
  {"tool": "list_products", "filters": {"low_stock": true}} - low stock alert
  {"tool": "list_products", "filters": {"featured": true}} - featured products
  {"tool": "list_products", "filters": {"on_sale": true}} - on sale
  {"tool": "list_products", "filters": {"category": "snowboards"}} - by category
  {"tool": "list_products", "filters": {"price_min": 50, "price_max": 200}} - price range
  {"tool": "list_products", "filters": {"sort_by": "best_selling"}} - best sellers
  {"tool": "list_products", "filters": {"sort_by": "newest"}} - newest first
  {"tool": "list_products", "filters": {"sort_by": "popular"}} - most viewed

TOOL: update_product - Update product fields
Return: {"tool": "update_product", "product": "name or sku", "updates": {"price": 99.99, "stock_quantity": 10}}

TOOL: delete_product - Delete a product
Return: {"tool": "delete_product", "product": "name or sku"}

═══ ATTRIBUTE TOOLS ═══
TOOL: list_attributes - List all attributes
Return: {"tool": "list_attributes"}

TOOL: create_attribute - Create a new attribute
Return: {"tool": "create_attribute", "code": "color", "name": "Color", "type": "select", "values": ["Red", "Blue", "Green"]}

TOOL: delete_attribute - Delete an attribute
Return: {"tool": "delete_attribute", "code": "attribute_code"}

═══ CUSTOMER TOOLS ═══
TOOL: list_customers - List/search customers
Filters: email, name, is_blacklisted, has_orders, sort_by (newest, orders, spent), limit
Examples:
  {"tool": "list_customers"} - all customers
  {"tool": "list_customers", "filters": {"email": "john@example.com"}} - find by email
  {"tool": "list_customers", "filters": {"name": "john"}} - search by name
  {"tool": "list_customers", "filters": {"is_blacklisted": true}} - blacklisted customers
  {"tool": "list_customers", "filters": {"has_orders": true}} - customers with orders
  {"tool": "list_customers", "filters": {"sort_by": "spent"}} - top spenders

TOOL: blacklist_customer - Blacklist a customer by email
Return: {"tool": "blacklist_customer", "email": "customer@email.com", "reason": "fraud"}

═══ ORDER TOOLS ═══
TOOL: list_orders - List/filter orders
Filters: status (pending, processing, shipped, delivered, cancelled), customer_email, date_from, date_to, sort_by (newest, oldest, total), limit
Examples:
  {"tool": "list_orders"} - all orders
  {"tool": "list_orders", "filters": {"status": "pending"}} - pending orders
  {"tool": "list_orders", "filters": {"status": "processing"}} - processing orders
  {"tool": "list_orders", "filters": {"customer_email": "john@example.com"}} - orders by customer
  {"tool": "list_orders", "filters": {"sort_by": "newest"}} - recent orders

TOOL: update_order_status - Update order status
Statuses: pending, processing, shipped, delivered, cancelled
Return: {"tool": "update_order_status", "order_number": "ORD-123", "status": "shipped"}

═══ COUPON TOOLS ═══
TOOL: list_coupons - List coupons
Return: {"tool": "list_coupons"}

TOOL: create_coupon - Create a discount coupon
Return: {"tool": "create_coupon", "code": "SAVE20", "discount_type": "percentage", "discount_value": 20}

TOOL: delete_coupon - Delete a coupon
Return: {"tool": "delete_coupon", "code": "COUPON_CODE"}

═══ LAYOUT & STYLING TOOLS ═══
TOOL: update_styling - Change element appearance (same as editor sidebar)
Elements: product_title, product_price, product_sku, product_short_description, add_to_cart_button, quantity_selector, stock_status, breadcrumbs, wishlist_button, related_products_title
Properties (CSS): color, backgroundColor, fontSize, fontWeight, textAlign, padding, paddingTop, paddingBottom, paddingLeft, paddingRight, margin, borderColor, borderWidth, borderRadius
Pages: product, cart, checkout, category, header, homepage
Color values: red, blue, green, orange, yellow, purple, pink, gray, black, white, or hex like #FF0000
Examples:
  {"tool": "update_styling", "element": "product_title", "property": "color", "value": "red"}
  {"tool": "update_styling", "element": "product_price", "property": "color", "value": "#FF0000"}
  {"tool": "update_styling", "element": "add_to_cart_button", "property": "backgroundColor", "value": "green"}
  {"tool": "update_styling", "element": "product_title", "property": "fontSize", "value": "24px"}
  {"tool": "update_styling", "element": "product_title", "property": "fontWeight", "value": "bold"}
  {"tool": "update_styling", "element": "product_title", "property": "textAlign", "value": "center"}
  {"tool": "update_styling", "element": "add_to_cart_button", "property": "padding", "value": "16px"}
  {"tool": "update_styling", "element": "add_to_cart_button", "property": "borderRadius", "value": "8px"}

TOOL: update_setting - Update store/catalog settings
Settings: show_stock_label, hide_currency_product, hide_quantity_selector, theme.primary_color, theme.breadcrumb_item_text_color
Examples:
  {"tool": "update_setting", "setting": "show_stock_label", "value": false}
  {"tool": "update_setting", "setting": "theme.primary_color", "value": "#FF5733"}
  {"tool": "update_setting", "setting": "hide_quantity_selector", "value": true}

TOOL: move_element - Move/reposition elements on storefront pages
Position is relative to TARGET: "above target" puts element BEFORE target, "below target" puts element AFTER target.
For compound positions like "above X and below Y" (between two elements), use the LOWER element as target with "above":
  "move title above sku and below price" → target=sku, position=above (places title between price and sku)
  "move title below price and above sku" → target=sku, position=above (same result)
Examples:
  {"tool": "move_element", "element": "sku", "position": "above", "target": "price"}
  {"tool": "move_element", "element": "stock_label", "position": "below", "target": "add_to_cart_button"}
  {"tool": "move_element", "element": "title", "position": "above", "target": "sku"} // places title between price and sku

═══ OTHER TOOLS ═══
TOOL: create_and_add - Create category and add product (after confirmation)
Return: {"tool": "create_and_add", "product": "product name", "category": "new category name"}

TOOL: ask_confirmation - Ask user to confirm an action
Return: {"tool": "ask_confirmation", "question": "Create category X?", "pending_action": {...}}

CURRENT STORE DATA:${storeData || '\nNo store data loaded.'}
${knowledgeBase ? `\nKNOWLEDGE:\n${knowledgeBase}` : ''}
${learnedExamples}

SYNONYMS (understand these as the same thing):
- products = articles = items = goods = inventory = stock
- categories = collections = groups = departments
- customers = clients = buyers = shoppers = users
- orders = purchases = transactions = sales
- coupons = discounts = promo codes = vouchers
- out of stock = sold out = unavailable = empty stock = zero stock
- in stock = available = have stock
- low stock = running low = almost out = need restock
- best selling = top sellers = most sold = popular
- newest = latest = recent = just added = new arrivals
- featured = promoted = highlighted = special

RULES:
1. ALWAYS return valid JSON with a "tool" field for actions
2. For questions/chat, return: {"tool": "chat", "message": "your response"}
3. If product/category not found, use ask_confirmation with create option
4. NEVER explain SQL or how to do things - just DO them
5. Be conversational but action-oriented
6. Understand natural language - "articles in snowboard" = products in category snowboard
7. "which products sold out" = out_of_stock filter
8. "what's running low" = low_stock filter
9. USE CONVERSATION CONTEXT: When user answers a clarifying question, combine their answer with previous context to execute immediately.
10. NEVER ask the same question twice.
11. COMPOUND COMMANDS: For multiple actions in one message, return an ARRAY of tool calls:
   "move sku below title and make it green" → [{"tool": "move_element", "element": "product_sku", "position": "below", "target": "product_title"}, {"tool": "update_styling", "element": "product_sku", "property": "color", "value": "green"}]
   "make title red and bold" → [{"tool": "update_styling", "element": "product_title", "property": "color", "value": "red"}, {"tool": "update_styling", "element": "product_title", "property": "fontWeight", "value": "bold"}]

Examples:
"create category hamid" → {"tool": "create_category", "name": "hamid"}
"list all categories" → {"tool": "list_categories"}
"delete category Sale" → {"tool": "delete_category", "name": "Sale"}
"add Blue T-Shirt to Sale" → {"tool": "add_to_category", "product": "Blue T-Shirt", "category": "Sale"}
"show products" → {"tool": "list_products"}
"products in stock" → {"tool": "list_products", "filters": {"in_stock": true}}
"out of stock products" → {"tool": "list_products", "filters": {"out_of_stock": true}}
"low stock alert" → {"tool": "list_products", "filters": {"low_stock": true}}
"best selling products" → {"tool": "list_products", "filters": {"sort_by": "best_selling"}}
"featured products" → {"tool": "list_products", "filters": {"featured": true}}
"products on sale" → {"tool": "list_products", "filters": {"on_sale": true}}
"products in snowboards category" → {"tool": "list_products", "filters": {"category": "snowboards"}}
"newest products" → {"tool": "list_products", "filters": {"sort_by": "newest"}}
"most popular products" → {"tool": "list_products", "filters": {"sort_by": "popular"}}
"products between $50 and $100" → {"tool": "list_products", "filters": {"price_min": 50, "price_max": 100}}
"find customer john@example.com" → {"tool": "list_customers", "filters": {"email": "john@example.com"}}
"top spending customers" → {"tool": "list_customers", "filters": {"sort_by": "spent"}}
"blacklisted customers" → {"tool": "list_customers", "filters": {"is_blacklisted": true}}
"pending orders" → {"tool": "list_orders", "filters": {"status": "pending"}}
"orders from john@example.com" → {"tool": "list_orders", "filters": {"customer_email": "john@example.com"}}
"recent orders" → {"tool": "list_orders", "filters": {"sort_by": "newest"}}
"ship order ORD-123" → {"tool": "update_order_status", "order_number": "ORD-123", "status": "shipped"}
"create coupon SAVE10 for 10% off" → {"tool": "create_coupon", "code": "SAVE10", "discount_type": "percentage", "discount_value": 10}
"yes" (after confirmation) → Execute pending action

MULTI-TURN CONVERSATION EXAMPLES:
Turn 1: User: "change color to red" → You ask: "Which element?"
Turn 2: User: "title" → You now have: element=title, property=color, value=red → {"tool": "update_styling", "element": "product_title", "property": "color", "value": "red"}

Turn 1: User: "make it bigger" → You ask: "Which element should be bigger?"
Turn 2: User: "the price" → You have: element=price, property=fontSize, value=bigger → {"tool": "update_styling", "element": "product_price", "property": "fontSize", "value": "32px"}

Natural language variations (same as above):
"articles in snowboard" → {"tool": "list_products", "filters": {"category": "snowboard"}}
"show me items in the sale collection" → {"tool": "list_products", "filters": {"category": "sale"}}
"what's sold out" → {"tool": "list_products", "filters": {"out_of_stock": true}}
"which products have sold out" → {"tool": "list_products", "filters": {"out_of_stock": true}}
"what do we need to restock" → {"tool": "list_products", "filters": {"low_stock": true}}
"inventory running low" → {"tool": "list_products", "filters": {"low_stock": true}}
"what are our top sellers" → {"tool": "list_products", "filters": {"sort_by": "best_selling"}}
"show me available inventory" → {"tool": "list_products", "filters": {"in_stock": true}}
"new arrivals" → {"tool": "list_products", "filters": {"sort_by": "newest"}}
"latest products added" → {"tool": "list_products", "filters": {"sort_by": "newest"}}
"who are my best clients" → {"tool": "list_customers", "filters": {"sort_by": "spent"}}
"show buyers who ordered" → {"tool": "list_customers", "filters": {"has_orders": true}}
"find client by email test@example.com" → {"tool": "list_customers", "filters": {"email": "test@example.com"}}
"unpaid orders" → {"tool": "list_orders", "filters": {"payment_status": "pending"}}
"what purchases need shipping" → {"tool": "list_orders", "filters": {"status": "processing"}}
"transactions from today" → {"tool": "list_orders", "filters": {"sort_by": "newest"}}

Layout & Styling - INTERPRET NATURAL LANGUAGE:
When users describe colors/styles naturally, translate to appropriate values:

COLOR INTERPRETATIONS:
- "warm color", "sunshine", "sunny" → yellow or orange (#eab308 or #f97316)
- "cool color", "calm", "ocean", "sky" → blue or teal (#3b82f6 or #14b8a6)
- "earthy", "natural", "wood" → brown or amber (#92400e or #f59e0b)
- "fresh", "nature", "forest" → green or emerald (#22c55e or #10b981)
- "elegant", "luxury", "royal" → purple or indigo (#a855f7 or #6366f1)
- "passionate", "urgent", "sale" → red or rose (#ef4444 or #f43f5e)
- "soft", "gentle", "muted" → gray or slate (#6b7280 or #64748b)
- "clean", "minimal", "modern" → white or very light gray (#ffffff or #f8fafc)
- "bold", "strong", "dark" → black or dark gray (#000000 or #1f2937)

SIZE INTERPRETATIONS:
- "bigger", "larger" → increase by ~25% (e.g., 24px → 30px)
- "smaller", "less prominent" → decrease by ~25%
- "much bigger", "huge" → increase by ~50%
- "slightly bigger", "a bit larger" → increase by ~10%
- "tiny", "very small" → 12px
- "normal", "regular" → 16px
- "large", "prominent" → 24px
- "extra large", "headline" → 32px

STYLE FEEL INTERPRETATIONS:
- "stand out", "eye-catching", "prominent" → bold weight, larger size
- "subtle", "understated" → lighter weight, muted color
- "professional", "corporate" → dark blue or gray, clean
- "playful", "fun" → bright colors, rounded corners
- "serious", "formal" → dark colors, sharp corners

Examples:
"make the title a warm sunshine color" → {"tool": "update_styling", "element": "product_title", "property": "color", "value": "#eab308"}
"give the button a calm ocean feel" → {"tool": "update_styling", "element": "add_to_cart_button", "property": "backgroundColor", "value": "#0ea5e9"}
"make the price stand out more" → {"tool": "update_styling", "element": "product_price", "property": "color", "value": "#ef4444"}
"make the title more prominent" → {"tool": "update_styling", "element": "product_title", "property": "fontSize", "value": "32px"}
"give the button rounded corners for a friendly feel" → {"tool": "update_styling", "element": "add_to_cart_button", "property": "borderRadius", "value": "12px"}
"make the description more subtle" → {"tool": "update_styling", "element": "product_short_description", "property": "color", "value": "#6b7280"}
"use an earthy brown for the title" → {"tool": "update_styling", "element": "product_title", "property": "color", "value": "#92400e"}

Basic examples:
"set product title color to red" → {"tool": "update_styling", "element": "product_title", "property": "color", "value": "#ef4444"}
"make add to cart button green" → {"tool": "update_styling", "element": "add_to_cart_button", "property": "backgroundColor", "value": "#22c55e"}
"center the title" → {"tool": "update_styling", "element": "product_title", "property": "textAlign", "value": "center"}
"hide stock label" → {"tool": "update_setting", "setting": "show_stock_label", "value": false}
"move sku above price" → {"tool": "move_element", "element": "product_sku", "position": "above", "target": "product_price"}

${images && images.length > 0 ? '\nUser attached image(s). Analyze for colors, patterns, and provide actionable insights.' : ''}

Return ONLY valid JSON.`;

    // ═══════════════════════════════════════════════════════════════════
    // STEP 6: Handle pending action confirmation (user said "yes")
    // ═══════════════════════════════════════════════════════════════════
    if (pendingAction && isConfirmation) {
      console.log('🔄 Executing pending action:', pendingAction);
      const result = await executeToolAction(pendingAction, storeId, userId, message);

      // Self-learning: record successful operation
      if (result.success) {
        await recordSuccessfulPattern(storeId, userId, pendingAction.originalMessage || message, pendingAction, result);
      }

      return res.json({
        success: true,
        message: result.message,
        data: { type: 'tool_executed', tool: pendingAction.tool, result: result.data },
        creditsDeducted: 0
      });
    }

    // ═══════════════════════════════════════════════════════════════════
    // STEP 7: Generate AI Response (tool call)
    // ═══════════════════════════════════════════════════════════════════
    const response = await aiService.generate({
      userId,
      operationType: 'chat',
      modelId: modelId || 'claude-sonnet',
      serviceKey: serviceKey || 'ai_chat_claude_sonnet',
      prompt: message || 'Please analyze this image.',
      systemPrompt,
      conversationHistory: conversationHistory.slice(-10),
      maxTokens: 800,
      temperature: 0.3, // Lower temp for more reliable JSON
      metadata: { type: 'tool-chat', storeId },
      images
    });

    // ═══════════════════════════════════════════════════════════════════
    // STEP 8: Parse AI response and execute tool
    // ═══════════════════════════════════════════════════════════════════
    let toolCall = null;
    let executionResult = null;
    let responseMessage = response.content;

    let toolCalls = [];
    try {
      // Try to parse JSON from response - could be single object or array
      // Also handle markdown code blocks (```json ... ```)
      let contentToParse = response.content;

      // Remove markdown code blocks if present
      const codeBlockMatch = contentToParse.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (codeBlockMatch) {
        contentToParse = codeBlockMatch[1].trim();
        console.log('🔧 Extracted JSON from code block');
      }

      const jsonMatch = contentToParse.match(/\[[\s\S]*\]|\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        // Handle both array and single object
        toolCalls = Array.isArray(parsed) ? parsed : [parsed];
        console.log('🔧 Tool calls detected:', toolCalls.length, toolCalls.map(t => t.tool));
      }
    } catch (e) {
      console.log('📝 No JSON tool call, treating as chat response:', e.message);
    }

    // Filter to actual tools (not chat)
    const executableTools = toolCalls.filter(t => t && t.tool && t.tool !== 'chat');
    toolCall = executableTools[0]; // Keep first for backwards compatibility

    // Execute ALL tools if we have multiple
    let allResults = [];
    if (executableTools.length > 0) {
      for (const tc of executableTools) {
        tc.originalMessage = message;
        console.log('🔧 Executing tool:', tc.tool);
        const result = await executeToolAction(tc, storeId, userId, message);
        allResults.push({ tool: tc.tool, result });
      }
      executionResult = allResults[allResults.length - 1]?.result; // Use last result for response
      // Clear the JSON from response message - show tool results instead
      responseMessage = allResults.map(r => r.result?.message || `${r.tool} executed`).join(' ');
    }

    // Execute the tool if we have one (single tool path)
    if (toolCall && toolCall.tool && toolCall.tool !== 'chat' && allResults.length === 0) {
      // Add original message for learning
      toolCall.originalMessage = message;

      executionResult = await executeToolAction(toolCall, storeId, userId, message);
      responseMessage = executionResult.message;

      // Self-learning: record successful operation
      if (executionResult.success && !executionResult.needsConfirmation) {
        await recordSuccessfulPattern(storeId, userId, message, toolCall, executionResult);
      }
    } else if (toolCall?.tool === 'chat') {
      responseMessage = toolCall.message || response.content;
    }

    // ═══════════════════════════════════════════════════════════════════
    // STEP 9: Return response with any pending action for confirmation
    // ═══════════════════════════════════════════════════════════════════
    // Handle multiple tool results
    if (allResults.length > 1) {
      // Combine messages from all tools
      const combinedMessages = allResults.map(r => r.result?.message || `${r.tool} executed`).join(' ');
      const hasStyling = allResults.some(r => ['styling_applied', 'layout_modified'].includes(r.result?.data?.type));

      console.log('📤 Multiple tools executed:', allResults.length, allResults.map(r => r.tool));

      return res.json({
        success: true,
        message: combinedMessages,
        data: {
          type: hasStyling ? 'styling_applied' : 'multi_tool',
          tools: allResults.map(r => r.tool),
          results: allResults.map(r => r.result?.data),
          refreshPreview: hasStyling
        },
        creditsDeducted: response.creditsDeducted
      });
    }

    // Bubble up styling_applied/layout types for frontend refresh detection
    const resultType = executionResult?.data?.type;
    const stylingTypes = ['styling_applied', 'styling_preview', 'layout_modified'];
    const responseType = executionResult?.needsConfirmation
      ? 'confirmation_needed'
      : (stylingTypes.includes(resultType) ? resultType : (toolCall ? 'tool_executed' : 'chat'));

    console.log('📤 Response debug:', {
      toolCall: toolCall?.tool,
      resultType,
      responseType,
      executionSuccess: executionResult?.success,
      executionData: executionResult?.data
    });

    res.json({
      success: true,
      message: responseMessage,
      data: {
        type: responseType,
        tool: toolCall?.tool,
        result: executionResult?.data,
        candidateId: executionResult?.candidateId,
        // Include these at top level for frontend refresh detection
        pageType: executionResult?.data?.pageType,
        slotId: executionResult?.data?.slotId,
        configId: executionResult?.data?.configId,
        refreshPreview: executionResult?.data?.refreshPreview
      },
      pendingAction: executionResult?.pendingAction, // For "yes" confirmation flow
      creditsDeducted: response.creditsDeducted
    });

  } catch (error) {
    console.error('Smart chat error:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to process request' });
  }
});

/**
 * Smart element matching - resolves user-friendly names to slot IDs
 * Uses fuzzy matching and reasoning instead of hardcoded maps
 */
function resolveSlotId(userInput, pageType = 'product') {
  if (!userInput) return null;

  // All valid slot IDs from product-config.js
  const validSlots = {
    product: [
      'product_title', 'product_price', 'product_sku', 'product_short_description',
      'add_to_cart_button', 'quantity_selector', 'stock_status', 'breadcrumbs',
      'wishlist_button', 'product_image', 'product_gallery', 'product_tabs',
      'related_products_title', 'related_products'
    ],
    category: ['category_title', 'category_description', 'product_grid', 'layered_navigation'],
    cart: ['cart_items', 'cart_summary', 'checkout_button'],
    header: ['logo', 'navigation', 'search', 'cart_icon', 'account']
  };

  const slots = validSlots[pageType] || validSlots.product;
  const input = userInput.toLowerCase().trim()
    .replace(/^(the|a|an)\s+/i, '') // Remove articles
    .replace(/\s+/g, '_'); // Replace spaces with underscores

  // 1. Exact match
  if (slots.includes(input)) return input;

  // 2. Check if input is already a valid slot ID with prefix
  const withPrefix = input.startsWith('product_') ? input : `product_${input}`;
  if (slots.includes(withPrefix)) return withPrefix;

  // 3. Semantic mappings (common variations)
  const semanticMap = {
    'title': 'product_title', 'name': 'product_title', 'heading': 'product_title',
    'price': 'product_price', 'cost': 'product_price', 'amount': 'product_price',
    'sku': 'product_sku', 'code': 'product_sku', 'article_number': 'product_sku',
    'description': 'product_short_description', 'desc': 'product_short_description', 'text': 'product_short_description',
    'button': 'add_to_cart_button', 'cart_button': 'add_to_cart_button', 'buy_button': 'add_to_cart_button',
    'add_to_cart': 'add_to_cart_button', 'cart': 'add_to_cart_button',
    'quantity': 'quantity_selector', 'qty': 'quantity_selector',
    'stock': 'stock_status', 'availability': 'stock_status', 'in_stock': 'stock_status',
    'breadcrumb': 'breadcrumbs', 'crumbs': 'breadcrumbs', 'path': 'breadcrumbs',
    'wishlist': 'wishlist_button', 'favorite': 'wishlist_button', 'heart': 'wishlist_button',
    'image': 'product_image', 'photo': 'product_image', 'picture': 'product_image',
    'gallery': 'product_gallery', 'images': 'product_gallery',
    'related': 'related_products', 'similar': 'related_products', 'recommendations': 'related_products'
  };

  if (semanticMap[input]) return semanticMap[input];

  // 4. Partial match - find slot that contains input or input contains slot
  for (const slot of slots) {
    const slotBase = slot.replace('product_', '').replace('_', '');
    const inputBase = input.replace('product_', '').replace('_', '');
    if (slotBase.includes(inputBase) || inputBase.includes(slotBase)) {
      return slot;
    }
  }

  // 5. Fallback - return input as-is (might be a valid custom slot)
  console.log('⚠️ Could not resolve slot ID for:', userInput, '- using as-is');
  return input;
}

/**
 * Execute a tool action from AI response
 * This is the core executor that handles all database operations
 * Uses Supabase client syntax (.from().select().eq())
 */
async function executeToolAction(toolCall, storeId, userId, originalMessage) {
  const ConnectionManager = require('../services/database/ConnectionManager');

  if (!storeId) {
    return { success: false, message: 'Store ID is required for this action.' };
  }

  const db = await ConnectionManager.getStoreConnection(storeId);
  const tool = toolCall.tool;

  console.log(`🔧 Executing tool: ${tool}`, toolCall);

  try {
    switch (tool) {
      // ═══════════════════════════════════════════════════════════════
      // ADD PRODUCT TO CATEGORY
      // ═══════════════════════════════════════════════════════════════
      case 'add_to_category': {
        const { product, category } = toolCall;

        // Find product by name in translations first (most common search)
        const { data: byName } = await db
          .from('product_translations')
          .select('product_id, name')
          .ilike('name', `%${product}%`)
          .limit(1);

        let productId = byName?.[0]?.product_id;
        let productName = byName?.[0]?.name;

        // If not found by name, try SKU
        if (!productId) {
          const { data: bySku } = await db
            .from('products')
            .select('id, sku')
            .ilike('sku', `%${product}%`)
            .limit(1);

          if (bySku?.[0]) {
            productId = bySku[0].id;
            // Get the name from translations
            const { data: translation } = await db
              .from('product_translations')
              .select('name')
              .eq('product_id', productId)
              .eq('language_code', 'en')
              .maybeSingle();
            productName = translation?.name || bySku[0].sku;
          }
        }

        if (!productId) {
          return {
            success: false,
            message: `I couldn't find a product matching "${product}". Can you check the name or SKU?`
          };
        }

        // Find category by name in translations first
        const { data: catByName } = await db
          .from('category_translations')
          .select('category_id, name')
          .ilike('name', `%${category}%`)
          .limit(1);

        let categoryId = catByName?.[0]?.category_id;
        let categoryName = catByName?.[0]?.name;

        // If not found by name, try slug
        if (!categoryId) {
          const { data: catBySlug } = await db
            .from('categories')
            .select('id, slug')
            .ilike('slug', `%${category}%`)
            .limit(1);

          if (catBySlug?.[0]) {
            categoryId = catBySlug[0].id;
            const { data: translation } = await db
              .from('category_translations')
              .select('name')
              .eq('category_id', categoryId)
              .eq('language_code', 'en')
              .maybeSingle();
            categoryName = translation?.name || catBySlug[0].slug;
          }
        }

        if (!categoryId) {
          // Category doesn't exist - ask to create
          return {
            success: false,
            needsConfirmation: true,
            message: `Category "${category}" doesn't exist. Would you like me to create it?`,
            pendingAction: {
              tool: 'create_and_add',
              product: productName,
              productId: productId,
              category: category,
              originalMessage
            }
          };
        }

        // Get current category_ids from product (uses JSONB array, not junction table)
        const { data: productData } = await db
          .from('products')
          .select('category_ids')
          .eq('id', productId)
          .single();

        const currentCategoryIds = productData?.category_ids || [];

        // Check if already in category
        if (currentCategoryIds.includes(categoryId)) {
          return {
            success: true,
            message: `"${productName}" is already in the "${categoryName}" category.`,
            data: { productId, categoryId, alreadyExists: true }
          };
        }

        // Add to category by updating the category_ids JSONB array
        const newCategoryIds = [...currentCategoryIds, categoryId];
        const { error: updateError } = await db
          .from('products')
          .update({ category_ids: newCategoryIds })
          .eq('id', productId);

        if (updateError) throw updateError;

        return {
          success: true,
          message: `Done! Added "${productName}" to the "${categoryName}" category.`,
          data: { productId, categoryId, productName, categoryName }
        };
      }

      // ═══════════════════════════════════════════════════════════════
      // CREATE CATEGORY AND ADD PRODUCT
      // ═══════════════════════════════════════════════════════════════
      case 'create_and_add': {
        const { product, productId, category } = toolCall;

        // Create the category
        const slug = category.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

        const { data: newCategory, error: catError } = await db
          .from('categories')
          .insert({
            slug,
            store_id: storeId,
            is_active: true,
            hide_in_menu: false,
            sort_order: 0,
            level: 0
          })
          .select('id')
          .single();

        if (catError) throw catError;

        const categoryId = newCategory.id;

        // Add translation
        const { error: transError } = await db
          .from('category_translations')
          .insert({
            category_id: categoryId,
            language_code: 'en',
            name: category
          });

        if (transError) console.error('Translation insert error:', transError);

        // Find product if we don't have ID
        let prodId = productId;
        if (!prodId && product) {
          const { data: products } = await db
            .from('product_translations')
            .select('product_id')
            .ilike('name', `%${product}%`)
            .limit(1);

          prodId = products?.[0]?.product_id;
        }

        // Add product to category if found (using category_ids JSONB array)
        if (prodId) {
          // Get current category_ids
          const { data: productData } = await db
            .from('products')
            .select('category_ids')
            .eq('id', prodId)
            .single();

          const currentCategoryIds = productData?.category_ids || [];
          const newCategoryIds = [...currentCategoryIds, categoryId];

          const { error: updateError } = await db
            .from('products')
            .update({ category_ids: newCategoryIds })
            .eq('id', prodId);

          if (updateError) console.error('Product category update error:', updateError);

          return {
            success: true,
            message: `Done! Created "${category}" category and added "${product}" to it.`,
            data: { categoryId, productId: prodId, categoryName: category }
          };
        }

        return {
          success: true,
          message: `Created "${category}" category, but couldn't find "${product}" to add.`,
          data: { categoryId, categoryName: category }
        };
      }

      // ═══════════════════════════════════════════════════════════════
      // CREATE CATEGORY ONLY
      // ═══════════════════════════════════════════════════════════════
      case 'create_category': {
        const { name } = toolCall;
        const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

        const { data: newCategory, error: catError } = await db
          .from('categories')
          .insert({
            slug,
            store_id: storeId,
            is_active: true,
            hide_in_menu: false,
            sort_order: 0,
            level: 0
          })
          .select('id')
          .single();

        if (catError) throw catError;

        const categoryId = newCategory.id;

        await db
          .from('category_translations')
          .insert({
            category_id: categoryId,
            language_code: 'en',
            name: name
          });

        return {
          success: true,
          message: `Done! Created the "${name}" category.`,
          data: { categoryId, categoryName: name }
        };
      }

      // ═══════════════════════════════════════════════════════════════
      // REMOVE FROM CATEGORY
      // ═══════════════════════════════════════════════════════════════
      case 'remove_from_category': {
        const { product, category } = toolCall;

        // Find product
        const { data: products } = await db
          .from('product_translations')
          .select('product_id, name')
          .ilike('name', `%${product}%`)
          .limit(1);

        const productRecord = products?.[0];

        // Find category
        const { data: categories } = await db
          .from('category_translations')
          .select('category_id, name')
          .ilike('name', `%${category}%`)
          .limit(1);

        const categoryRecord = categories?.[0];

        if (!productRecord || !categoryRecord) {
          return {
            success: false,
            message: `Couldn't find ${!productRecord ? 'product' : 'category'} "${!productRecord ? product : category}".`
          };
        }

        // Get current category_ids from product (uses JSONB array, not junction table)
        const { data: productData } = await db
          .from('products')
          .select('category_ids')
          .eq('id', productRecord.product_id)
          .single();

        const currentCategoryIds = productData?.category_ids || [];
        const wasInCategory = currentCategoryIds.includes(categoryRecord.category_id);

        // Remove from category by filtering out the category_id
        const newCategoryIds = currentCategoryIds.filter(id => id !== categoryRecord.category_id);

        if (wasInCategory) {
          const { error: updateError } = await db
            .from('products')
            .update({ category_ids: newCategoryIds })
            .eq('id', productRecord.product_id);

          if (updateError) throw updateError;
        }

        return {
          success: true,
          message: wasInCategory
            ? `Removed "${productRecord.name}" from "${categoryRecord.name}".`
            : `"${productRecord.name}" wasn't in "${categoryRecord.name}".`,
          data: { productId: productRecord.product_id, categoryId: categoryRecord.category_id, removed: wasInCategory }
        };
      }

      // ═══════════════════════════════════════════════════════════════
      // QUERY DATA
      // ═══════════════════════════════════════════════════════════════
      case 'query_data': {
        const { type, filters = {} } = toolCall;
        let data, message;

        switch (type) {
          case 'out_of_stock': {
            const { data: products } = await db
              .from('products')
              .select('id, sku, stock_quantity')
              .lte('stock_quantity', 0)
              .limit(20);

            // Get translations for these products
            if (products?.length) {
              const productIds = products.map(p => p.id);
              const { data: translations } = await db
                .from('product_translations')
                .select('product_id, name')
                .in('product_id', productIds)
                .eq('language_code', 'en');

              const transMap = new Map(translations?.map(t => [t.product_id, t.name]) || []);
              data = products.map(p => ({ ...p, name: transMap.get(p.id) || p.sku }));
            } else {
              data = [];
            }

            message = data.length
              ? `Found ${data.length} out of stock products:\n${data.map(p => `• ${p.name || p.sku}`).join('\n')}`
              : 'No products are currently out of stock.';
            break;
          }

          case 'categories': {
            const { data: cats } = await db
              .from('categories')
              .select('id, slug, is_active, product_count')
              .order('id')
              .limit(30);

            if (cats?.length) {
              const catIds = cats.map(c => c.id);
              const { data: translations } = await db
                .from('category_translations')
                .select('category_id, name')
                .in('category_id', catIds)
                .eq('language_code', 'en');

              const transMap = new Map(translations?.map(t => [t.category_id, t.name]) || []);
              data = cats.map(c => ({ ...c, name: transMap.get(c.id) || c.slug }));
            } else {
              data = [];
            }

            message = `Found ${data.length} categories:\n${data.map(c => `• ${c.name || c.slug} (${c.product_count || 0} products)`).join('\n')}`;
            break;
          }

          default:
            message = `Query type "${type}" not yet implemented.`;
            data = null;
        }

        return { success: true, message, data: { type, items: data } };
      }

      // ═══════════════════════════════════════════════════════════════
      // LIST CATEGORIES
      // ═══════════════════════════════════════════════════════════════
      case 'list_categories': {
        const { data: cats } = await db
          .from('categories')
          .select('id, slug, is_active, product_count')
          .order('id')
          .limit(50);

        if (!cats?.length) {
          return { success: true, message: 'No categories found.', data: { items: [] } };
        }

        const catIds = cats.map(c => c.id);
        const { data: translations } = await db
          .from('category_translations')
          .select('category_id, name')
          .in('category_id', catIds)
          .eq('language_code', 'en');

        const transMap = new Map(translations?.map(t => [t.category_id, t.name]) || []);
        const items = cats.map(c => ({ ...c, name: transMap.get(c.id) || c.slug }));

        return {
          success: true,
          message: `Found ${items.length} categories:\n${items.map(c => `• ${c.name} (${c.product_count || 0} products)${c.is_active ? '' : ' [inactive]'}`).join('\n')}`,
          data: { items }
        };
      }

      // ═══════════════════════════════════════════════════════════════
      // DELETE CATEGORY
      // ═══════════════════════════════════════════════════════════════
      case 'delete_category': {
        const { name } = toolCall;

        const { data: categories } = await db
          .from('category_translations')
          .select('category_id, name')
          .ilike('name', `%${name}%`)
          .limit(1);

        if (!categories?.[0]) {
          return { success: false, message: `Category "${name}" not found.` };
        }

        const categoryId = categories[0].category_id;
        const categoryName = categories[0].name;

        // Delete translations first, then category
        await db.from('category_translations').delete().eq('category_id', categoryId);
        await db.from('product_categories').delete().eq('category_id', categoryId);
        const { error } = await db.from('categories').delete().eq('id', categoryId);

        if (error) throw error;

        return {
          success: true,
          message: `Deleted category "${categoryName}".`,
          data: { categoryId, categoryName }
        };
      }

      // ═══════════════════════════════════════════════════════════════
      // LIST PRODUCTS (Enhanced with webshop manager filters)
      // ═══════════════════════════════════════════════════════════════
      case 'list_products': {
        const filters = toolCall.filters || {};
        let query = db.from('products').select('id, sku, price, compare_price, stock_quantity, low_stock_threshold, status, featured, view_count, category_ids, created_at');

        // Stock filters
        if (filters.in_stock) {
          query = query.gt('stock_quantity', 0);
        }
        if (filters.out_of_stock) {
          query = query.lte('stock_quantity', 0);
        }
        if (filters.low_stock) {
          // Products where stock <= low_stock_threshold (default 5)
          query = query.or('stock_quantity.lte.low_stock_threshold,stock_quantity.lte.5');
        }

        // Status filter
        if (filters.status) {
          query = query.eq('status', filters.status);
        }

        // Featured filter
        if (filters.featured) {
          query = query.eq('featured', true);
        }

        // On sale filter (compare_price > price)
        if (filters.on_sale) {
          query = query.not('compare_price', 'is', null).gt('compare_price', 0);
        }

        // Price range filters
        if (filters.price_min) {
          query = query.gte('price', filters.price_min);
        }
        if (filters.price_max) {
          query = query.lte('price', filters.price_max);
        }

        // Sorting
        const sortBy = filters.sort_by;
        if (sortBy === 'price_asc') {
          query = query.order('price', { ascending: true });
        } else if (sortBy === 'price_desc') {
          query = query.order('price', { ascending: false });
        } else if (sortBy === 'newest') {
          query = query.order('created_at', { ascending: false });
        } else if (sortBy === 'oldest') {
          query = query.order('created_at', { ascending: true });
        } else if (sortBy === 'popular') {
          query = query.order('view_count', { ascending: false });
        } else if (sortBy === 'stock_asc') {
          query = query.order('stock_quantity', { ascending: true });
        } else if (sortBy === 'stock_desc') {
          query = query.order('stock_quantity', { ascending: false });
        }

        const { data: products } = await query.limit(filters.limit || 30);

        if (!products?.length) {
          return { success: true, message: 'No products found matching your criteria.', data: { items: [] } };
        }

        // Filter by category if specified (category_ids is JSONB array)
        let filteredProducts = products;
        if (filters.category) {
          // Find category ID by name
          const { data: categories } = await db
            .from('category_translations')
            .select('category_id')
            .ilike('name', `%${filters.category}%`)
            .limit(1);

          if (categories?.[0]) {
            const catId = categories[0].category_id;
            filteredProducts = products.filter(p => p.category_ids?.includes(catId));
          }
        }

        // Handle best_selling sort (requires order data aggregation)
        if (sortBy === 'best_selling') {
          const productIds = filteredProducts.map(p => p.id);
          const { data: salesData } = await db
            .from('sales_order_items')
            .select('product_id, quantity')
            .in('product_id', productIds);

          // Aggregate sales by product
          const salesMap = new Map();
          salesData?.forEach(item => {
            salesMap.set(item.product_id, (salesMap.get(item.product_id) || 0) + item.quantity);
          });

          // Sort by sales
          filteredProducts.sort((a, b) => (salesMap.get(b.id) || 0) - (salesMap.get(a.id) || 0));
        }

        // Get translations
        const productIds = filteredProducts.map(p => p.id);
        const { data: translations } = await db
          .from('product_translations')
          .select('product_id, name')
          .in('product_id', productIds)
          .eq('language_code', 'en');

        const transMap = new Map(translations?.map(t => [t.product_id, t.name]) || []);
        const items = filteredProducts.map(p => ({
          ...p,
          name: transMap.get(p.id) || p.sku,
          on_sale: p.compare_price && p.compare_price > p.price
        }));

        // Build descriptive message
        let filterDesc = '';
        if (filters.in_stock) filterDesc = 'in stock';
        else if (filters.out_of_stock) filterDesc = 'out of stock';
        else if (filters.low_stock) filterDesc = 'low stock';
        else if (filters.featured) filterDesc = 'featured';
        else if (filters.on_sale) filterDesc = 'on sale';
        else if (filters.category) filterDesc = `in "${filters.category}"`;
        else if (sortBy === 'best_selling') filterDesc = 'best selling';
        else if (sortBy === 'newest') filterDesc = 'newest';
        else if (sortBy === 'popular') filterDesc = 'most popular';

        const statusEmoji = (p) => {
          if (p.stock_quantity <= 0) return '🔴';
          if (p.stock_quantity <= (p.low_stock_threshold || 5)) return '🟡';
          return '🟢';
        };

        return {
          success: true,
          message: `Found ${items.length} ${filterDesc} products:\n${items.slice(0, 20).map(p =>
            `${statusEmoji(p)} ${p.name} (${p.sku}) - $${p.price}${p.on_sale ? ` ~~$${p.compare_price}~~` : ''} | Stock: ${p.stock_quantity}${p.featured ? ' ⭐' : ''}`
          ).join('\n')}${items.length > 20 ? `\n... and ${items.length - 20} more` : ''}`,
          data: { items, filterApplied: filterDesc || 'all' }
        };
      }

      // ═══════════════════════════════════════════════════════════════
      // UPDATE PRODUCT
      // ═══════════════════════════════════════════════════════════════
      case 'update_product': {
        const { product, updates } = toolCall;

        // Find product by name first (most common search)
        const { data: byName } = await db
          .from('product_translations')
          .select('product_id, name')
          .ilike('name', `%${product}%`)
          .limit(1);

        let productId = byName?.[0]?.product_id;
        let productName = byName?.[0]?.name;

        // If not found by name, try SKU
        if (!productId) {
          const { data: bySku } = await db
            .from('products')
            .select('id, sku')
            .ilike('sku', `%${product}%`)
            .limit(1);
          if (bySku?.[0]) {
            productId = bySku[0].id;
            productName = bySku[0].sku;
          }
        }

        if (!productId) {
          return { success: false, message: `Product "${product}" not found.` };
        }

        // Update product
        const { error } = await db
          .from('products')
          .update(updates)
          .eq('id', productId);

        if (error) throw error;

        return {
          success: true,
          message: `Updated product "${productName}": ${Object.entries(updates).map(([k, v]) => `${k}=${v}`).join(', ')}`,
          data: { productId, updates }
        };
      }

      // ═══════════════════════════════════════════════════════════════
      // DELETE PRODUCT
      // ═══════════════════════════════════════════════════════════════
      case 'delete_product': {
        const { product } = toolCall;

        // Find product by name first (most common search)
        const { data: byName } = await db
          .from('product_translations')
          .select('product_id, name')
          .ilike('name', `%${product}%`)
          .limit(1);

        let productId = byName?.[0]?.product_id;
        let productName = byName?.[0]?.name;

        // If not found by name, try SKU
        if (!productId) {
          const { data: bySku } = await db
            .from('products')
            .select('id, sku')
            .ilike('sku', `%${product}%`)
            .limit(1);
          if (bySku?.[0]) {
            productId = bySku[0].id;
            productName = bySku[0].sku;
          }
        }

        if (!productId) {
          return { success: false, message: `Product "${product}" not found.` };
        }

        // Delete related data then product (no product_categories - uses category_ids JSONB on products)
        await db.from('product_translations').delete().eq('product_id', productId);
        await db.from('product_attribute_values').delete().eq('product_id', productId);
        const { error } = await db.from('products').delete().eq('id', productId);

        if (error) throw error;

        return {
          success: true,
          message: `Deleted product "${productName}".`,
          data: { productId: productRecord.id }
        };
      }

      // ═══════════════════════════════════════════════════════════════
      // LIST ATTRIBUTES
      // ═══════════════════════════════════════════════════════════════
      case 'list_attributes': {
        const { data: attrs } = await db
          .from('attributes')
          .select('id, code, name, type, is_filterable')
          .order('code')
          .limit(50);

        if (!attrs?.length) {
          return { success: true, message: 'No attributes found.', data: { items: [] } };
        }

        const attrIds = attrs.map(a => a.id);
        const { data: translations } = await db
          .from('attribute_translations')
          .select('attribute_id, label')
          .in('attribute_id', attrIds)
          .eq('language_code', 'en');

        // Use translation label if available, otherwise fall back to attribute.name or code
        const transMap = new Map(translations?.map(t => [t.attribute_id, t.label]) || []);
        const items = attrs.map(a => ({ ...a, displayName: transMap.get(a.id) || a.name || a.code }));

        return {
          success: true,
          message: `Found ${items.length} attributes:\n${items.map(a => `• ${a.name} (${a.code}) - Type: ${a.type}${a.is_filterable ? ' [filterable]' : ''}`).join('\n')}`,
          data: { items }
        };
      }

      // ═══════════════════════════════════════════════════════════════
      // CREATE ATTRIBUTE
      // ═══════════════════════════════════════════════════════════════
      case 'create_attribute': {
        const { code, name, type = 'text', values = [] } = toolCall;

        const attrCode = code.toLowerCase().replace(/[^a-z0-9]+/g, '_');
        const attrName = name || code;

        // Create attribute with required name and store_id fields
        const { data: newAttr, error: attrError } = await db
          .from('attributes')
          .insert({
            name: attrName,
            code: attrCode,
            type,
            store_id: storeId,
            is_filterable: type === 'select' || type === 'multiselect'
          })
          .select('id')
          .single();

        if (attrError) throw attrError;

        // Add translation (uses 'label' not 'name')
        await db.from('attribute_translations').insert({
          attribute_id: newAttr.id,
          language_code: 'en',
          label: attrName
        });

        // Add values if provided (attribute_values needs 'code' not 'position')
        if (values.length > 0 && (type === 'select' || type === 'multiselect')) {
          for (let i = 0; i < values.length; i++) {
            const valueCode = values[i].toLowerCase().replace(/[^a-z0-9]+/g, '_');
            const { data: newValue } = await db
              .from('attribute_values')
              .insert({
                attribute_id: newAttr.id,
                code: valueCode,
                sort_order: i
              })
              .select('id')
              .single();

            if (newValue) {
              await db.from('attribute_value_translations').insert({
                attribute_value_id: newValue.id,
                language_code: 'en',
                value: values[i]
              });
            }
          }
        }

        return {
          success: true,
          message: `Created attribute "${attrName}" (${attrCode})${values.length ? ` with values: ${values.join(', ')}` : ''}.`,
          data: { attributeId: newAttr.id, code: attrCode }
        };
      }

      // ═══════════════════════════════════════════════════════════════
      // DELETE ATTRIBUTE
      // ═══════════════════════════════════════════════════════════════
      case 'delete_attribute': {
        const { code } = toolCall;

        const { data: attr } = await db
          .from('attributes')
          .select('id, code')
          .ilike('code', code)
          .single();

        if (!attr) {
          return { success: false, message: `Attribute "${code}" not found.` };
        }

        // Delete related data
        const { data: values } = await db.from('attribute_values').select('id').eq('attribute_id', attr.id);
        if (values?.length) {
          const valueIds = values.map(v => v.id);
          await db.from('attribute_value_translations').delete().in('attribute_value_id', valueIds);
        }
        await db.from('attribute_values').delete().eq('attribute_id', attr.id);
        await db.from('attribute_translations').delete().eq('attribute_id', attr.id);
        await db.from('product_attributes').delete().eq('attribute_id', attr.id);
        const { error } = await db.from('attributes').delete().eq('id', attr.id);

        if (error) throw error;

        return {
          success: true,
          message: `Deleted attribute "${attr.code}".`,
          data: { attributeId: attr.id }
        };
      }

      // ═══════════════════════════════════════════════════════════════
      // LIST CUSTOMERS
      // ═══════════════════════════════════════════════════════════════
      case 'list_customers': {
        const filters = toolCall.filters || {};
        const limit = filters.limit || toolCall.limit || 20;

        let query = db.from('customers').select('id, email, first_name, last_name, phone, is_active, is_blacklisted, total_spent, total_orders, last_order_date, created_at');

        // Email filter (exact or partial match)
        if (filters.email) {
          query = query.ilike('email', `%${filters.email}%`);
        }

        // Name filter (search in first_name or last_name)
        if (filters.name) {
          query = query.or(`first_name.ilike.%${filters.name}%,last_name.ilike.%${filters.name}%`);
        }

        // Blacklisted filter
        if (filters.is_blacklisted !== undefined) {
          query = query.eq('is_blacklisted', filters.is_blacklisted);
        }

        // Has orders filter
        if (filters.has_orders) {
          query = query.gt('total_orders', 0);
        }

        // Active filter
        if (filters.is_active !== undefined) {
          query = query.eq('is_active', filters.is_active);
        }

        // Sorting
        const sortBy = filters.sort_by;
        if (sortBy === 'spent') {
          query = query.order('total_spent', { ascending: false });
        } else if (sortBy === 'orders') {
          query = query.order('total_orders', { ascending: false });
        } else if (sortBy === 'newest') {
          query = query.order('created_at', { ascending: false });
        } else if (sortBy === 'oldest') {
          query = query.order('created_at', { ascending: true });
        } else if (sortBy === 'last_order') {
          query = query.order('last_order_date', { ascending: false, nullsFirst: false });
        } else {
          query = query.order('created_at', { ascending: false });
        }

        const { data: customers } = await query.limit(limit);

        if (!customers?.length) {
          return { success: true, message: 'No customers found matching your criteria.', data: { items: [] } };
        }

        // Build descriptive message
        let filterDesc = '';
        if (filters.email) filterDesc = `matching "${filters.email}"`;
        else if (filters.name) filterDesc = `matching name "${filters.name}"`;
        else if (filters.is_blacklisted) filterDesc = 'blacklisted';
        else if (filters.has_orders) filterDesc = 'with orders';
        else if (sortBy === 'spent') filterDesc = 'top spending';
        else if (sortBy === 'orders') filterDesc = 'most orders';

        const formatCurrency = (val) => val ? `$${parseFloat(val).toFixed(2)}` : '$0.00';

        return {
          success: true,
          message: `Found ${customers.length} ${filterDesc} customers:\n${customers.map(c =>
            `• ${c.first_name || ''} ${c.last_name || ''} (${c.email})${c.is_blacklisted ? ' 🚫' : ''}${c.is_active ? '' : ' [inactive]'} | Orders: ${c.total_orders || 0} | Spent: ${formatCurrency(c.total_spent)}`
          ).join('\n')}`,
          data: { items: customers, filterApplied: filterDesc || 'all' }
        };
      }

      // ═══════════════════════════════════════════════════════════════
      // BLACKLIST CUSTOMER
      // ═══════════════════════════════════════════════════════════════
      case 'blacklist_customer': {
        const { email, reason = 'Blacklisted by admin' } = toolCall;

        const { error } = await db
          .from('blacklist_emails')
          .insert({ email, reason, store_id: storeId });

        if (error && error.code === '23505') {
          return { success: true, message: `Email "${email}" is already blacklisted.` };
        }
        if (error) throw error;

        // Also update customer record if exists
        await db
          .from('customers')
          .update({ is_blacklisted: true, blacklist_reason: reason, blacklisted_at: new Date().toISOString() })
          .eq('email', email);

        return {
          success: true,
          message: `Blacklisted email "${email}".`,
          data: { email, reason }
        };
      }

      // ═══════════════════════════════════════════════════════════════
      // LIST ORDERS
      // ═══════════════════════════════════════════════════════════════
      case 'list_orders': {
        const filters = toolCall.filters || {};
        const limit = filters.limit || toolCall.limit || 20;

        let query = db
          .from('sales_orders')
          .select('id, order_number, status, payment_status, fulfillment_status, total_amount, customer_email, customer_phone, shipping_method, tracking_number, created_at');

        // Status filter
        if (filters.status || toolCall.status) {
          query = query.eq('status', filters.status || toolCall.status);
        }

        // Payment status filter
        if (filters.payment_status) {
          query = query.eq('payment_status', filters.payment_status);
        }

        // Fulfillment status filter
        if (filters.fulfillment_status) {
          query = query.eq('fulfillment_status', filters.fulfillment_status);
        }

        // Customer email filter
        if (filters.customer_email) {
          query = query.ilike('customer_email', `%${filters.customer_email}%`);
        }

        // Date range filters
        if (filters.date_from) {
          query = query.gte('created_at', filters.date_from);
        }
        if (filters.date_to) {
          query = query.lte('created_at', filters.date_to);
        }

        // Min/max total filters
        if (filters.min_total) {
          query = query.gte('total_amount', filters.min_total);
        }
        if (filters.max_total) {
          query = query.lte('total_amount', filters.max_total);
        }

        // Sorting
        const sortBy = filters.sort_by;
        if (sortBy === 'newest') {
          query = query.order('created_at', { ascending: false });
        } else if (sortBy === 'oldest') {
          query = query.order('created_at', { ascending: true });
        } else if (sortBy === 'total_high') {
          query = query.order('total_amount', { ascending: false });
        } else if (sortBy === 'total_low') {
          query = query.order('total_amount', { ascending: true });
        } else {
          query = query.order('created_at', { ascending: false });
        }

        const { data: orders } = await query.limit(limit);

        if (!orders?.length) {
          return { success: true, message: 'No orders found matching your criteria.', data: { items: [] } };
        }

        // Build descriptive message
        let filterDesc = '';
        if (filters.status || toolCall.status) filterDesc = `${filters.status || toolCall.status}`;
        else if (filters.customer_email) filterDesc = `from "${filters.customer_email}"`;
        else if (filters.payment_status) filterDesc = `payment: ${filters.payment_status}`;
        else if (sortBy === 'total_high') filterDesc = 'highest value';

        const statusEmoji = (status) => {
          switch (status) {
            case 'pending': return '🟡';
            case 'processing': return '🔵';
            case 'shipped': return '📦';
            case 'delivered': return '✅';
            case 'cancelled': return '❌';
            default: return '⚪';
          }
        };

        const formatDate = (d) => new Date(d).toLocaleDateString();

        return {
          success: true,
          message: `Found ${orders.length} ${filterDesc} orders:\n${orders.map(o =>
            `${statusEmoji(o.status)} #${o.order_number} - ${o.status} - $${parseFloat(o.total_amount).toFixed(2)} (${o.customer_email}) - ${formatDate(o.created_at)}${o.tracking_number ? ` 📍${o.tracking_number}` : ''}`
          ).join('\n')}`,
          data: { items: orders, filterApplied: filterDesc || 'all' }
        };
      }

      // ═══════════════════════════════════════════════════════════════
      // UPDATE ORDER STATUS
      // ═══════════════════════════════════════════════════════════════
      case 'update_order_status': {
        const { order_number, status } = toolCall;

        const { data: order } = await db
          .from('sales_orders')
          .select('id, order_number, status')
          .eq('order_number', order_number)
          .single();

        if (!order) {
          return { success: false, message: `Order "${order_number}" not found.` };
        }

        const { error } = await db
          .from('sales_orders')
          .update({ status, updated_at: new Date().toISOString() })
          .eq('id', order.id);

        if (error) throw error;

        return {
          success: true,
          message: `Updated order #${order_number} status from "${order.status}" to "${status}".`,
          data: { orderId: order.id, oldStatus: order.status, newStatus: status }
        };
      }

      // ═══════════════════════════════════════════════════════════════
      // LIST COUPONS
      // ═══════════════════════════════════════════════════════════════
      case 'list_coupons': {
        const { data: coupons } = await db
          .from('coupons')
          .select('id, code, discount_type, discount_value, is_active, usage_count, usage_limit')
          .order('created_at', { ascending: false })
          .limit(30);

        if (!coupons?.length) {
          return { success: true, message: 'No coupons found.', data: { items: [] } };
        }

        return {
          success: true,
          message: `Found ${coupons.length} coupons:\n${coupons.map(c => `• ${c.code}: ${c.discount_value}${c.discount_type === 'percentage' ? '%' : '$'} off${c.is_active ? '' : ' [inactive]'} (used ${c.usage_count}/${c.usage_limit || '∞'})`).join('\n')}`,
          data: { items: coupons }
        };
      }

      // ═══════════════════════════════════════════════════════════════
      // CREATE COUPON
      // ═══════════════════════════════════════════════════════════════
      case 'create_coupon': {
        const { code, name, discount_type = 'percentage', discount_value, usage_limit = null } = toolCall;

        // name and store_id are required fields
        const couponName = name || `${discount_value}${discount_type === 'percentage' ? '%' : '$'} off coupon`;

        const { data: newCoupon, error } = await db
          .from('coupons')
          .insert({
            name: couponName,
            code: code.toUpperCase(),
            store_id: storeId,
            discount_type,
            discount_value,
            is_active: true,
            usage_count: 0,
            usage_limit
          })
          .select('id')
          .single();

        if (error) {
          if (error.code === '23505') {
            return { success: false, message: `Coupon code "${code}" already exists.` };
          }
          throw error;
        }

        return {
          success: true,
          message: `Created coupon "${code.toUpperCase()}" for ${discount_value}${discount_type === 'percentage' ? '%' : '$'} off.`,
          data: { couponId: newCoupon.id, code: code.toUpperCase() }
        };
      }

      // ═══════════════════════════════════════════════════════════════
      // DELETE COUPON
      // ═══════════════════════════════════════════════════════════════
      case 'delete_coupon': {
        const { code } = toolCall;

        const { data: coupon } = await db
          .from('coupons')
          .select('id, code')
          .ilike('code', code)
          .single();

        if (!coupon) {
          return { success: false, message: `Coupon "${code}" not found.` };
        }

        const { error } = await db.from('coupons').delete().eq('id', coupon.id);

        if (error) throw error;

        return {
          success: true,
          message: `Deleted coupon "${coupon.code}".`,
          data: { couponId: coupon.id }
        };
      }

      // ═══════════════════════════════════════════════════════════════
      // UPDATE STYLING - Change element colors, fonts, sizes
      // ═══════════════════════════════════════════════════════════════
      case 'update_styling': {
        const { element, property, value, page = 'product' } = toolCall;

        console.log('🎨 update_styling called:', { element, property, value, page });

        if (!element) {
          return { success: false, message: 'Please specify which element to style (e.g., product title, price, button).' };
        }

        // Use smart element matching
        const slotId = resolveSlotId(element, page);
        console.log('🎨 Resolved element:', element, '→', slotId);

        // Map property names to CSS camelCase (matching EditorSidebar)
        const propertyMap = {
          'color': 'color',
          'text color': 'color',
          'text-color': 'color',
          'textcolor': 'color',
          'background': 'backgroundColor',
          'background color': 'backgroundColor',
          'background-color': 'backgroundColor',
          'backgroundcolor': 'backgroundColor',
          'bgcolor': 'backgroundColor',
          'font size': 'fontSize',
          'font-size': 'fontSize',
          'fontsize': 'fontSize',
          'size': 'fontSize',
          'font weight': 'fontWeight',
          'font-weight': 'fontWeight',
          'fontweight': 'fontWeight',
          'weight': 'fontWeight',
          'bold': 'fontWeight',
          'text align': 'textAlign',
          'text-align': 'textAlign',
          'textalign': 'textAlign',
          'align': 'textAlign',
          'alignment': 'textAlign',
          'padding': 'padding',
          'padding top': 'paddingTop',
          'padding-top': 'paddingTop',
          'padding bottom': 'paddingBottom',
          'padding-bottom': 'paddingBottom',
          'padding left': 'paddingLeft',
          'padding-left': 'paddingLeft',
          'padding right': 'paddingRight',
          'padding-right': 'paddingRight',
          'margin': 'margin',
          'border': 'border',
          'border color': 'borderColor',
          'border-color': 'borderColor',
          'bordercolor': 'borderColor',
          'border width': 'borderWidth',
          'border-width': 'borderWidth',
          'border radius': 'borderRadius',
          'border-radius': 'borderRadius',
          'borderradius': 'borderRadius',
          'radius': 'borderRadius',
          'rounded': 'borderRadius'
        };

        const styleProp = propertyMap[property?.toLowerCase()] || property || 'color';

        // Map color names to hex values (matching EditorSidebar color picker)
        const colorNameToHex = {
          'red': '#ef4444', 'blue': '#3b82f6', 'green': '#22c55e',
          'orange': '#f97316', 'yellow': '#eab308', 'purple': '#a855f7',
          'pink': '#ec4899', 'gray': '#6b7280', 'grey': '#6b7280',
          'black': '#000000', 'white': '#ffffff',
          'indigo': '#6366f1', 'teal': '#14b8a6', 'cyan': '#06b6d4',
          'lime': '#84cc16', 'amber': '#f59e0b', 'rose': '#f43f5e',
          'emerald': '#10b981', 'sky': '#0ea5e9', 'violet': '#8b5cf6',
          'fuchsia': '#d946ef', 'slate': '#64748b', 'zinc': '#71717a',
          'neutral': '#737373', 'stone': '#78716c'
        };

        // Map font weight names
        const fontWeightMap = {
          'thin': '100', 'extralight': '200', 'light': '300',
          'normal': '400', 'medium': '500', 'semibold': '600',
          'bold': '700', 'extrabold': '800', 'black': '900'
        };

        // Map alignment values
        const alignmentMap = {
          'left': 'left', 'center': 'center', 'right': 'right',
          'justify': 'justify', 'start': 'left', 'end': 'right', 'middle': 'center'
        };

        // Determine the actual style value
        let styleValue = value;
        const valueLower = value?.toLowerCase();

        // Handle color properties
        if (styleProp === 'color' || styleProp === 'backgroundColor' || styleProp === 'borderColor') {
          if (colorNameToHex[valueLower]) {
            styleValue = colorNameToHex[valueLower];
          } else if (value && !value.startsWith('#') && !value.startsWith('rgb')) {
            // Try to interpret as hex without #
            if (/^[0-9a-fA-F]{6}$/.test(value)) {
              styleValue = '#' + value;
            }
          }
        }

        // Handle font weight
        if (styleProp === 'fontWeight') {
          if (fontWeightMap[valueLower]) {
            styleValue = fontWeightMap[valueLower];
          } else if (valueLower === 'bold') {
            styleValue = '700';
          } else if (valueLower === 'normal') {
            styleValue = '400';
          }
        }

        // Handle text alignment
        if (styleProp === 'textAlign') {
          styleValue = alignmentMap[valueLower] || value;
        }

        // Handle font size (add px if just a number)
        if (styleProp === 'fontSize') {
          if (/^\d+$/.test(value)) {
            styleValue = value + 'px';
          }
        }

        // Handle padding/margin (add px if just a number)
        if (styleProp.includes('padding') || styleProp.includes('margin')) {
          if (/^\d+$/.test(value)) {
            styleValue = value + 'px';
          }
        }

        console.log('🎨 Resolved style:', { slotId, styleProp, styleValue });

        // Look for draft first, then published
        let { data: draftConfig } = await db
          .from('slot_configurations')
          .select('id, configuration, version_number')
          .eq('store_id', storeId)
          .eq('page_type', page)
          .eq('status', 'draft')
          .order('version_number', { ascending: false })
          .limit(1)
          .maybeSingle();

        let configId;
        let configuration;

        if (draftConfig) {
          // Update existing draft
          configuration = draftConfig.configuration || { slots: {} };
          configId = draftConfig.id;
        } else {
          // No draft - check for published to clone from
          const { data: publishedConfig } = await db
            .from('slot_configurations')
            .select('id, configuration, version_number')
            .eq('store_id', storeId)
            .eq('page_type', page)
            .eq('status', 'published')
            .order('version_number', { ascending: false })
            .limit(1)
            .maybeSingle();

          if (publishedConfig) {
            // Clone from published to create new draft
            configuration = JSON.parse(JSON.stringify(publishedConfig.configuration || { slots: {} }));
            const { data: newDraft } = await db
              .from('slot_configurations')
              .insert({
                store_id: storeId,
                user_id: userId,
                page_type: page,
                configuration,
                status: 'draft',
                is_active: true,
                version_number: (publishedConfig.version_number || 1) + 1,
                parent_version_id: publishedConfig.id
              })
              .select('id')
              .single();
            configId = newDraft?.id;
          } else {
            // No config at all - create fresh draft
            configuration = { slots: {} };
            const { data: newDraft } = await db
              .from('slot_configurations')
              .insert({
                store_id: storeId,
                user_id: userId,
                page_type: page,
                configuration,
                status: 'draft',
                is_active: true,
                version_number: 1
              })
              .select('id')
              .single();
            configId = newDraft?.id;
          }
        }

        // Ensure slots structure exists
        if (!configuration.slots) configuration.slots = {};
        if (!configuration.slots[slotId]) {
          configuration.slots[slotId] = { styles: {}, className: '' };
        }
        if (!configuration.slots[slotId].styles) {
          configuration.slots[slotId].styles = {};
        }

        // Apply the inline style (matching how EditorSidebar saves styles)
        configuration.slots[slotId].styles[styleProp] = styleValue;
        console.log('🎨 Applied inline style:', styleProp, '=', styleValue, 'to slot:', slotId);

        // Update the draft
        console.log('🎨 Updating draft config:', configId, 'slot:', slotId, 'with:', styleProp, '=', styleValue);
        const { error: updateError } = await db
          .from('slot_configurations')
          .update({
            configuration,
            updated_at: new Date().toISOString(),
            has_unpublished_changes: true
          })
          .eq('id', configId);

        if (updateError) {
          console.error('🎨 Failed to update styling:', updateError);
          return { success: false, message: `Failed to update styling: ${updateError.message}` };
        }

        console.log('🎨 Styling updated successfully!');
        const friendlyElement = (element || slotId || 'element').replace(/_/g, ' ');
        const friendlyProperty = styleProp.replace(/([A-Z])/g, ' $1').toLowerCase().trim();
        return {
          success: true,
          message: `Changed ${friendlyElement} ${friendlyProperty} to ${value}.`,
          data: {
            type: 'styling_applied',
            configId,
            pageType: page,
            slotId,
            property: styleProp,
            value: styleValue,
            refreshPreview: true
          }
        };
      }

      // ═══════════════════════════════════════════════════════════════
      // UPDATE SETTING - Store/catalog settings
      // ═══════════════════════════════════════════════════════════════
      case 'update_setting': {
        const { setting, value } = toolCall;

        // Get current store settings
        const { data: store } = await db
          .from('stores')
          .select('id, settings')
          .eq('id', storeId)
          .single();

        if (!store) {
          return { success: false, message: 'Store not found.' };
        }

        let settings = store.settings || {};

        // Handle nested settings (e.g., "theme.primary_color")
        if (setting.includes('.')) {
          const parts = setting.split('.');
          let current = settings;
          for (let i = 0; i < parts.length - 1; i++) {
            if (!current[parts[i]]) current[parts[i]] = {};
            current = current[parts[i]];
          }
          current[parts[parts.length - 1]] = value;
        } else {
          settings[setting] = value;
        }

        await db
          .from('stores')
          .update({ settings, updated_at: new Date().toISOString() })
          .eq('id', storeId);

        const friendlySetting = setting.replace(/_/g, ' ').replace(/\./g, ' > ');
        return {
          success: true,
          message: `Updated ${friendlySetting} to ${value}. Refresh your storefront to see the changes.`,
          data: { type: 'setting', setting, value }
        };
      }

      // ═══════════════════════════════════════════════════════════════
      // MOVE ELEMENT - Reposition elements on pages
      // ═══════════════════════════════════════════════════════════════
      case 'move_element': {
        const { element, position, target, page = 'product' } = toolCall;

        console.log('🔄 move_element called:', { element, position, target, page });

        // Use smart element matching
        const sourceSlot = resolveSlotId(element, page);
        const targetSlot = resolveSlotId(target, page);
        console.log('🔄 Resolved slots:', element, '→', sourceSlot, '| target:', target, '→', targetSlot);
        const normalizedPosition = ['above', 'before'].includes(position?.toLowerCase()) ? 'before' : 'after';

        // Look for draft first, then published
        let { data: draftConfig } = await db
          .from('slot_configurations')
          .select('id, configuration, version_number')
          .eq('store_id', storeId)
          .eq('page_type', page)
          .eq('status', 'draft')
          .order('version_number', { ascending: false })
          .limit(1)
          .maybeSingle();

        let configId;
        let configuration;

        if (draftConfig) {
          configuration = draftConfig.configuration || { slots: {}, layout: [] };
          configId = draftConfig.id;
        } else {
          const { data: publishedConfig } = await db
            .from('slot_configurations')
            .select('id, configuration, version_number')
            .eq('store_id', storeId)
            .eq('page_type', page)
            .eq('status', 'published')
            .order('version_number', { ascending: false })
            .limit(1)
            .maybeSingle();

          if (publishedConfig) {
            configuration = JSON.parse(JSON.stringify(publishedConfig.configuration || { slots: {}, layout: [] }));
            const { data: newDraft } = await db
              .from('slot_configurations')
              .insert({
                store_id: storeId,
                user_id: userId,
                page_type: page,
                configuration,
                status: 'draft',
                is_active: true,
                version_number: (publishedConfig.version_number || 1) + 1,
                parent_version_id: publishedConfig.id
              })
              .select('id')
              .single();
            configId = newDraft?.id;
          } else {
            configuration = { slots: {}, layout: [] };
            const { data: newDraft } = await db
              .from('slot_configurations')
              .insert({
                store_id: storeId,
                user_id: userId,
                page_type: page,
                configuration,
                status: 'draft',
                is_active: true,
                version_number: 1
              })
              .select('id')
              .single();
            configId = newDraft?.id;
          }
        }

        if (!configuration.slots) configuration.slots = {};
        if (!configuration.layout) configuration.layout = [];

        // Ensure both slots exist with proper structure
        if (!configuration.slots[sourceSlot]) {
          configuration.slots[sourceSlot] = { styles: {}, position: { col: 1, row: 0 } };
        }
        if (!configuration.slots[sourceSlot].styles) {
          configuration.slots[sourceSlot].styles = {};
        }
        if (!configuration.slots[sourceSlot].position) {
          configuration.slots[sourceSlot].position = { col: 1, row: 0 };
        }
        if (!configuration.slots[targetSlot]) {
          configuration.slots[targetSlot] = { styles: {}, position: { col: 1, row: 0 } };
        }
        if (!configuration.slots[targetSlot].position) {
          configuration.slots[targetSlot].position = { col: 1, row: 0 };
        }

        // Build hierarchy info from configuration
        // Also include well-known container hierarchies for common page types
        const knownHierarchies = {
          product: {
            // product_title is inside info_container at row 1
            product_title: { parentId: 'info_container', position: { col: 1, row: 1 } },
            // cms_block_product_above_price at row 2
            cms_block_product_above_price: { parentId: 'info_container', position: { col: 1, row: 2 } },
            // price_container is inside info_container at row 3
            price_container: { parentId: 'info_container', position: { col: 1, row: 3 } },
            // product_price and original_price are inside price_container
            product_price: { parentId: 'price_container', position: { col: 1, row: 1 } },
            original_price: { parentId: 'price_container', position: { col: 2, row: 1 } },
            // stock_status is in info_container at row 4
            stock_status: { parentId: 'info_container', position: { col: 1, row: 4 } },
            // product_sku is in info_container at row 5
            product_sku: { parentId: 'info_container', position: { col: 1, row: 5 } },
            // short description is in info_container at row 6
            product_short_description: { parentId: 'info_container', position: { col: 1, row: 6 } },
            // info_container is inside content_area
            info_container: { parentId: 'content_area', position: { col: 7, row: 1 } }
          }
        };

        // Merge known hierarchies with configuration for full slot info
        // IMPORTANT: Do this BEFORE reading parentId values
        const pageHierarchy = knownHierarchies[page] || {};
        const fullSlots = { ...pageHierarchy };
        Object.keys(configuration.slots).forEach(key => {
          fullSlots[key] = { ...pageHierarchy[key], ...configuration.slots[key] };
        });

        // Get position and parent info from merged fullSlots (includes knownHierarchies)
        // This ensures we have correct parentId even for slots not yet customized
        const targetPos = fullSlots[targetSlot]?.position || configuration.slots[targetSlot]?.position || { col: 1, row: 0 };
        const sourcePos = fullSlots[sourceSlot]?.position || configuration.slots[sourceSlot]?.position || { col: 1, row: 0 };
        const targetParentId = fullSlots[targetSlot]?.parentId || configuration.slots[targetSlot]?.parentId;
        const sourceParentId = fullSlots[sourceSlot]?.parentId || configuration.slots[sourceSlot]?.parentId;

        console.log('🔄 Move hierarchy check:', {
          sourceSlot,
          targetSlot,
          sourceParentId,
          targetParentId,
          sourcePos,
          targetPos
        });

        // Find the effective parent and position for the source element
        // If target is in a nested container (like price_container which is inside info_container),
        // and source is already in the parent container (info_container),
        // we should position source relative to the nested container, not inside it.
        let effectiveParentId = sourceParentId;
        let effectiveTargetRow;
        let newCol = targetPos.col ?? 1;

        // Check if target's parent container exists and has its own parent
        const targetParentSlot = fullSlots[targetParentId];
        const targetParentParentId = targetParentSlot?.parentId;

        if (targetParentId && targetParentSlot &&
            sourceParentId === targetParentParentId) {
          // Source and target's container share the same parent
          // Position source relative to target's container, not inside it
          const containerPos = targetParentSlot.position || { col: 1, row: 0 };
          effectiveTargetRow = containerPos.row ?? 0;
          // Keep source in its current parent (the shared grandparent)
          effectiveParentId = sourceParentId;
          newCol = containerPos.col ?? 1;
          console.log('🔄 Target is nested in container:', targetParentId, 'at row', effectiveTargetRow, '- positioning relative to container');
        } else if (sourceParentId === targetParentId) {
          // Both are in the same container - simple case
          effectiveTargetRow = targetPos.row ?? 0;
          effectiveParentId = targetParentId;
        } else {
          // Different containers - move source to target's container
          effectiveTargetRow = targetPos.row ?? 0;
          effectiveParentId = targetParentId;
        }

        // Calculate new position for source slot
        // 'before/above' = same column, lower row (appears first)
        // 'after/below' = same column, higher row (appears after)
        let newRow;
        if (normalizedPosition === 'before') {
          newRow = effectiveTargetRow - 0.5;
        } else {
          newRow = effectiveTargetRow + 0.5;
        }

        // Update parentId only if we're actually moving to a different container
        if (effectiveParentId !== undefined && effectiveParentId !== sourceParentId) {
          configuration.slots[sourceSlot].parentId = effectiveParentId;
        }

        // Update source slot's position for grid sorting
        // sortSlotsByGridCoordinates sorts by row first, then col
        configuration.slots[sourceSlot].position = {
          col: newCol,
          row: newRow
        };

        console.log('🔄 Move element:', sourceSlot, 'from', sourcePos, '(parent:', sourceParentId, ') to { col:', newCol, ', row:', newRow, ', parentId:', effectiveParentId, '}', `(${normalizedPosition}`, targetSlot, 'at', targetPos, ')');

        await db
          .from('slot_configurations')
          .update({
            configuration,
            updated_at: new Date().toISOString(),
            has_unpublished_changes: true
          })
          .eq('id', configId);

        const posWord = normalizedPosition === 'before' ? 'above' : 'below';
        return {
          success: true,
          message: `Moved ${element.replace(/_/g, ' ')} ${posWord} ${target.replace(/_/g, ' ')}.`,
          data: {
            type: 'styling_applied',
            configId,
            pageType: page,
            slotId: sourceSlot,
            refreshPreview: true
          }
        };
      }

      // ═══════════════════════════════════════════════════════════════
      // ASK CONFIRMATION (passthrough)
      // ═══════════════════════════════════════════════════════════════
      case 'ask_confirmation': {
        return {
          success: false,
          needsConfirmation: true,
          message: toolCall.question,
          pendingAction: { ...toolCall.pending_action, originalMessage }
        };
      }

      default:
        return {
          success: false,
          message: `Unknown tool "${tool}". Available tools: list_categories, create_category, delete_category, list_products, update_product, delete_product, list_attributes, create_attribute, delete_attribute, list_customers, blacklist_customer, list_orders, update_order_status, list_coupons, create_coupon, delete_coupon, add_to_category, remove_from_category.`
        };
    }
  } catch (error) {
    console.error(`Tool execution error (${tool}):`, error);
    return {
      success: false,
      message: `Something went wrong: ${error.message}. Please try again.`
    };
  }
}

/**
 * Record successful pattern for self-learning
 * This feeds back into the RAG system so the AI learns what works
 */
async function recordSuccessfulPattern(storeId, userId, userMessage, toolCall, result) {
  try {
    // Capture as training candidate with high confidence
    const captureResult = await aiTrainingService.captureTrainingCandidate({
      storeId,
      userId,
      sessionId: `tool_${Date.now()}`,
      userPrompt: userMessage,
      aiResponse: result.message,
      detectedIntent: toolCall.tool,
      detectedEntity: toolCall.product || toolCall.category || toolCall.type || 'general',
      detectedOperation: toolCall.tool,
      actionTaken: toolCall,
      confidenceScore: 0.95, // High confidence for successful executions
      metadata: {
        toolCall,
        result: result.data,
        autoLearned: true
      }
    });

    // Immediately mark as success
    if (captureResult?.candidateId) {
      await aiTrainingService.updateOutcome(captureResult.candidateId, 'success', {
        toolExecuted: toolCall.tool,
        timestamp: new Date().toISOString()
      });
      console.log(`📚 Learned pattern: "${userMessage}" → ${toolCall.tool}`);
    }

    // Also record in learning feedback for pattern matching
    await aiLearningService.recordFeedback({
      storeId,
      userId,
      conversationId: `tool_${Date.now()}`,
      messageId: `success_${Date.now()}`,
      userMessage,
      aiResponse: result.message,
      intent: toolCall.tool,
      entity: toolCall.product || toolCall.category || 'general',
      operation: toolCall.tool,
      wasHelpful: true,
      feedbackText: 'Auto-learned: tool executed successfully',
      metadata: { toolCall, autoLearned: true }
    });

  } catch (error) {
    console.error('Failed to record successful pattern:', error);
  }
}

/**
 * Track successful operations for self-learning AND capture as training candidate
 * This automatically records successful patterns and captures them for training validation
 */
async function trackSuccessfulOperation(storeId, userId, userMessage, intent, entity, operation, response, confidenceScore = 0.8) {
  try {
    // Record as positive feedback (automatic success)
    await aiLearningService.recordFeedback({
      storeId,
      userId,
      conversationId: `auto_${Date.now()}`,
      messageId: `success_${Date.now()}`,
      userMessage,
      aiResponse: response?.substring?.(0, 500) || 'Operation successful',
      intent,
      entity,
      operation,
      wasHelpful: true, // Automatic success = helpful
      feedbackText: 'Auto-recorded: operation completed successfully',
      metadata: { autoRecorded: true }
    });

    // Also capture as training candidate for automatic validation
    const captureResult = await aiTrainingService.captureTrainingCandidate({
      storeId,
      userId,
      sessionId: `auto_${Date.now()}`,
      userPrompt: userMessage,
      aiResponse: response?.substring?.(0, 500) || 'Operation successful',
      detectedIntent: intent,
      detectedEntity: entity,
      detectedOperation: operation,
      actionTaken: { intent, entity, operation },
      confidenceScore,
      metadata: { autoRecorded: true }
    });

    // If captured, immediately mark as success outcome
    if (captureResult.captured && captureResult.candidateId) {
      await aiTrainingService.updateOutcome(captureResult.candidateId, 'success', {
        autoRecorded: true,
        timestamp: new Date().toISOString()
      });
    }

    console.log(`[AI Learning] Auto-tracked success: ${intent}/${entity}/${operation}`);
  } catch (error) {
    // Don't fail the main operation if learning fails
    console.error('[AI Learning] Failed to track success:', error);
  }
}

/**
 * POST /api/ai/generate
 * Generate AI response with credit deduction
 */
router.post('/generate', authMiddleware, async (req, res) => {
  try {
    const {
      operationType,
      prompt,
      systemPrompt,
      model,
      maxTokens,
      temperature,
      metadata
    } = req.body;

    const userId = req.user.id;

    if (!operationType || !prompt) {
      return res.status(400).json({
        success: false,
        message: 'operationType and prompt are required'
      });
    }

    // Generate AI response
    const result = await aiService.generate({
      userId,
      operationType,
      prompt,
      systemPrompt,
      model,
      maxTokens,
      temperature,
      metadata
    });

    // Get remaining credits
    const creditsRemaining = await aiService.getRemainingCredits(userId);

    res.json({
      success: true,
      content: result.content,
      usage: result.usage,
      creditsDeducted: result.creditsDeducted,
      creditsRemaining
    });

  } catch (error) {
    console.error('AI Generate Error:', error);

    // Handle insufficient credits error
    if (error.message.includes('Insufficient credits')) {
      return res.status(402).json({
        success: false,
        code: 'INSUFFICIENT_CREDITS',
        message: error.message,
        required: error.required,
        available: error.available
      });
    }

    res.status(500).json({
      success: false,
      message: error.message || 'AI generation failed'
    });
  }
});

/**
 * POST /api/ai/generate/stream
 * Stream AI response with credit deduction
 */
router.post('/generate/stream', authMiddleware, async (req, res) => {
  try {
    const {
      operationType,
      prompt,
      systemPrompt,
      model,
      maxTokens,
      temperature,
      metadata
    } = req.body;

    const userId = req.user.id;

    if (!operationType || !prompt) {
      return res.status(400).json({
        success: false,
        message: 'operationType and prompt are required'
      });
    }

    // Set headers for streaming
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    // Stream AI response
    const stream = aiService.generateStream({
      userId,
      operationType,
      prompt,
      systemPrompt,
      model,
      maxTokens,
      temperature,
      metadata
    });

    for await (const chunk of stream) {
      res.write(`data: ${JSON.stringify({ content: chunk })}\n\n`);
    }

    // Send completion and usage stats
    const creditsRemaining = await aiService.getRemainingCredits(userId);
    res.write(`data: ${JSON.stringify({
      usage: { creditsRemaining },
      done: true
    })}\n\n`);
    res.write('data: [DONE]\n\n');
    res.end();

  } catch (error) {
    console.error('AI Stream Error:', error);

    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        message: error.message || 'AI streaming failed'
      });
    }
  }
});

/**
 * POST /api/ai/stream-thinking
 * Stream AI response with tool usage display
 * Shows tool calls in real-time
 */
router.post('/stream-thinking', authMiddleware, async (req, res) => {
  try {
    const {
      message,
      history = [],
      systemPrompt,
      enableTools = true
    } = req.body;

    const userId = req.user.id;
    const storeId = req.headers['x-store-id'] || req.body.storeId;

    if (!message) {
      return res.status(400).json({
        success: false,
        message: 'message is required'
      });
    }

    // Check credits first
    const creditCheck = await aiService.checkCredits(userId, 'general', 'ai_chat_claude_sonnet');
    if (!creditCheck.hasCredits) {
      return res.status(402).json({
        success: false,
        code: 'INSUFFICIENT_CREDITS',
        message: `Insufficient credits. Required: ${creditCheck.required}, Available: ${creditCheck.available}`
      });
    }

    console.log('🧠 Extended Thinking Stream started');
    console.log('📝 Message:', message.substring(0, 100));

    // Set headers for SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering

    // Build messages array from history
    const messages = [
      ...history.map(h => ({
        role: h.role,
        content: h.content
      })),
      { role: 'user', content: message }
    ];

    // Get tools if enabled
    const tools = enableTools ? aiProvider.getWebshopTools() : [];

    // Build system prompt for webshop assistant
    const fullSystemPrompt = systemPrompt || `You are an AI assistant for a webshop management platform.
You help store managers with:
- Product management and catalog optimization
- Order processing and fulfillment
- Customer insights and analytics
- Store configuration and settings

When answering questions about the store, use the available tools to query real data.
Always explain what you're checking/searching before using a tool.
Be concise but helpful.`;

    // Create tool execution handler for when AI requests tools
    const toolResults = {};
    let pendingToolUse = null;

    // Get model from database (claude-sonnet for tool-use tasks)
    const modelConfig = await aiModelsService.getModelConfig('claude-sonnet');
    const model = modelConfig?.model || 'claude-3-5-sonnet-20241022';

    // Stream with tools
    const stream = aiProvider.streamWithThinking(messages, {
      model,
      maxTokens: 4096,
      systemPrompt: fullSystemPrompt,
      tools
    });

    let totalUsage = { input_tokens: 0, output_tokens: 0 };

    for await (const event of stream) {
      // Send event to client
      res.write(`data: ${JSON.stringify(event)}\n\n`);

      // Track tool usage for execution
      if (event.type === 'tool_start') {
        pendingToolUse = {
          name: event.tool,
          id: event.id,
          input: ''
        };
      }

      if (event.type === 'tool_input' && pendingToolUse) {
        pendingToolUse.input += event.json || '';
      }

      if (event.type === 'block_stop' && event.blockType === 'tool_use' && pendingToolUse) {
        // Parse tool input and execute
        try {
          const toolInput = JSON.parse(pendingToolUse.input || '{}');
          const toolName = pendingToolUse.name;

          // Execute tool based on name
          let toolResult = null;

          if (storeId) {
            const ConnectionManager = require('../services/database/ConnectionManager');
            const tenantDb = await ConnectionManager.getConnection(storeId);

            if (toolName === 'query_products') {
              let query = tenantDb.from('products').select('id, name, price, status, stock_quantity');
              if (toolInput.search) {
                query = query.ilike('name', `%${toolInput.search}%`);
              }
              if (toolInput.category) {
                query = query.eq('category_id', toolInput.category);
              }
              if (toolInput.min_price) {
                query = query.gte('price', toolInput.min_price);
              }
              if (toolInput.max_price) {
                query = query.lte('price', toolInput.max_price);
              }
              const { data } = await query.limit(toolInput.limit || 10);
              toolResult = data || [];
            }

            if (toolName === 'query_orders') {
              let query = tenantDb.from('orders').select('id, status, total_amount, created_at');
              if (toolInput.status) {
                query = query.eq('status', toolInput.status);
              }
              if (toolInput.date_from) {
                query = query.gte('created_at', toolInput.date_from);
              }
              if (toolInput.date_to) {
                query = query.lte('created_at', toolInput.date_to);
              }
              const { data } = await query.order('created_at', { ascending: false }).limit(toolInput.limit || 10);
              toolResult = data || [];
            }

            if (toolName === 'query_customers') {
              let query = tenantDb.from('customers').select('id, email, first_name, last_name, created_at');
              if (toolInput.search) {
                query = query.or(`email.ilike.%${toolInput.search}%,first_name.ilike.%${toolInput.search}%,last_name.ilike.%${toolInput.search}%`);
              }
              const { data } = await query.limit(toolInput.limit || 10);
              toolResult = data || [];
            }

            if (toolName === 'get_store_stats') {
              const { data: products } = await tenantDb.from('products').select('id', { count: 'exact', head: true });
              const { data: orders } = await tenantDb.from('orders').select('id', { count: 'exact', head: true });
              const { data: revenue } = await tenantDb.from('orders').select('total_amount').eq('status', 'completed');
              toolResult = {
                total_products: products?.length || 0,
                total_orders: orders?.length || 0,
                total_revenue: revenue?.reduce((sum, o) => sum + (o.total_amount || 0), 0) || 0
              };
            }

            if (toolName === 'query_categories') {
              let query = tenantDb.from('categories').select('id, name, slug, parent_id');
              if (toolInput.parent_id) {
                query = query.eq('parent_id', toolInput.parent_id);
              }
              const { data } = await query;
              toolResult = data || [];
            }

            // Handle styling tools by delegating to executeToolAction
            if (toolName === 'update_styling' || toolName === 'update_setting' || toolName === 'move_element') {
              console.log('🎨 Stream-thinking: Delegating styling tool to executeToolAction');
              const toolCall = { tool: toolName, ...toolInput };
              const result = await executeToolAction(toolCall, storeId, userId, '');
              toolResult = result;

              // Send styling_applied event for frontend refresh
              if (result.success && result.data?.type === 'styling_applied') {
                res.write(`data: ${JSON.stringify({
                  type: 'styling_applied',
                  ...result.data
                })}\n\n`);
              }
            }
          } else {
            toolResult = { error: 'No store context available' };
          }

          // Store result and send to client
          toolResults[pendingToolUse.id] = toolResult;
          res.write(`data: ${JSON.stringify({
            type: 'tool_result',
            id: pendingToolUse.id,
            tool: toolName,
            result: toolResult
          })}\n\n`);

        } catch (toolError) {
          console.error('Tool execution error:', toolError);
          res.write(`data: ${JSON.stringify({
            type: 'tool_error',
            id: pendingToolUse.id,
            error: toolError.message
          })}\n\n`);
        }

        pendingToolUse = null;
      }

      // Track usage
      if (event.type === 'done' && event.usage) {
        totalUsage = event.usage;
      }
    }

    // Deduct credits after streaming completes
    try {
      await aiService.deductCredits(userId, 'general', {
        storeId,
        modelId: 'claude-sonnet',
        serviceKey: 'ai_chat_claude_sonnet',
        tokensInput: totalUsage.input_tokens,
        tokensOutput: totalUsage.output_tokens
      });
    } catch (creditError) {
      console.error('Failed to deduct credits:', creditError);
    }

    // Send completion
    const creditsRemaining = await aiService.getRemainingCredits(userId);
    res.write(`data: ${JSON.stringify({
      type: 'complete',
      usage: totalUsage,
      creditsRemaining,
      creditsDeducted: await aiService.getOperationCost('general', 'ai_chat_claude_sonnet')
    })}\n\n`);

    res.write('data: [DONE]\n\n');
    res.end();

  } catch (error) {
    console.error('Extended thinking stream error:', error);

    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        message: error.message || 'Extended thinking stream failed'
      });
    } else {
      res.write(`data: ${JSON.stringify({ type: 'error', error: error.message })}\n\n`);
      res.end();
    }
  }
});

/**
 * GET /api/ai/cost/:operationType
 * Get cost for an operation type
 */
router.get('/cost/:operationType', authMiddleware, async (req, res) => {
  try {
    const { operationType } = req.params;
    const cost = aiService.getOperationCost(operationType);

    res.json({
      success: true,
      operationType,
      cost
    });
  } catch (error) {
    console.error('Error fetching cost:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch operation cost'
    });
  }
});

/**
 * GET /api/ai/credits
 * Get user's remaining credits
 */
router.get('/credits', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const credits = await aiService.getRemainingCredits(userId);

    res.json({
      success: true,
      credits
    });
  } catch (error) {
    console.error('Error fetching credits:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch credits'
    });
  }
});

/**
 * POST /api/ai/check-credits
 * Check if user has sufficient credits for an operation
 */
router.post('/check-credits', authMiddleware, async (req, res) => {
  try {
    const { operationType } = req.body;
    const userId = req.user.id;

    if (!operationType) {
      return res.status(400).json({
        success: false,
        message: 'operationType is required'
      });
    }

    const result = await aiService.checkCredits(userId, operationType);

    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    console.error('Error checking credits:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to check credits'
    });
  }
});

/**
 * GET /api/ai/usage-history
 * Get user's AI usage history
 */
router.get('/usage-history', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const limit = parseInt(req.query.limit) || 50;

    const history = await aiService.getUserUsageHistory(userId, limit);

    res.json({
      success: true,
      history
    });
  } catch (error) {
    console.error('Error fetching usage history:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch usage history'
    });
  }
});

/**
 * ========================================
 * SPECIALIZED OPERATION ENDPOINTS
 * ========================================
 */

/**
 * POST /api/ai/plugin/generate
 * Generate a plugin with RAG context
 */
router.post('/plugin/generate', authMiddleware, async (req, res) => {
  try {
    const { prompt, category, storeId } = req.body;
    const userId = req.user.id;

    if (!prompt) {
      return res.status(400).json({
        success: false,
        message: 'prompt is required'
      });
    }

    const result = await aiService.generatePlugin(userId, prompt, {
      category,
      storeId
    });

    res.json({
      success: true,
      plugin: result.pluginData,
      usage: result.usage,
      creditsDeducted: result.creditsDeducted
    });

  } catch (error) {
    console.error('Plugin Generation Error:', error);

    if (error.message.includes('Insufficient credits')) {
      return res.status(402).json({
        success: false,
        code: 'INSUFFICIENT_CREDITS',
        message: error.message
      });
    }

    res.status(500).json({
      success: false,
      message: error.message || 'Plugin generation failed'
    });
  }
});

/**
 * POST /api/ai/plugin/create
 * Save generated plugin to database (plugin_registry, plugin_scripts, plugin_hooks)
 */
router.post('/plugin/create', authMiddleware, async (req, res) => {
  try {
    const { pluginData } = req.body;

    // Debug logging
    console.log('🔍 Plugin Create Request:');
    console.log('  - req.user:', req.user);
    console.log('  - req.user?.id:', req.user?.id);
    console.log('  - pluginData.name:', pluginData?.name);

    const userId = req.user?.id;

    if (!pluginData) {
      return res.status(400).json({
        success: false,
        message: 'pluginData is required'
      });
    }

    if (!userId) {
      console.error('❌ User not authenticated - req.user:', req.user);
      return res.status(401).json({
        success: false,
        message: 'User not authenticated. Please log in.',
        debug: {
          hasUser: !!req.user,
          userId: req.user?.id,
          userKeys: req.user ? Object.keys(req.user) : []
        }
      });
    }

    console.log(`✅ Creating plugin for user: ${userId}`);

    // Check if user has 50 credits for plugin creation
    const creditCheck = await aiService.checkCredits(userId, 'plugin-generation');
    if (!creditCheck.hasCredits) {
      return res.status(402).json({
        success: false,
        code: 'INSUFFICIENT_CREDITS',
        message: `Insufficient credits. Required: ${creditCheck.required}, Available: ${creditCheck.available}`,
        required: creditCheck.required,
        available: creditCheck.available
      });
    }

    // Deduct 50 credits for plugin creation
    await aiService.deductCredits(userId, 'plugin-generation', {
      pluginName: pluginData.name,
      action: 'create-plugin'
    });

    console.log(`💰 Deducted 50 credits for plugin creation`);

    // Save plugin to database using aiService instance
    const result = await aiService.savePluginToDatabase(pluginData, userId);

    console.log(`✅ Plugin created:`, result);

    // Get remaining credits
    const creditsRemaining = await aiService.getRemainingCredits(userId);

    res.json({
      success: true,
      message: 'Plugin created successfully',
      pluginId: result.pluginId,
      plugin: {
        ...pluginData,
        id: result.pluginId,
        slug: result.slug
      },
      creditsDeducted: 50,
      creditsRemaining
    });

  } catch (error) {
    console.error('❌ Plugin Creation Error:', error);
    console.error('Error stack:', error.stack);

    // Return detailed error for debugging
    res.status(500).json({
      success: false,
      message: error.message || 'Plugin creation failed',
      error: error.message,
      details: {
        hasUser: !!req.user,
        userId: req.user?.id,
        errorType: error.name
      }
    });
  }
});

/**
 * POST /api/ai/plugin/modify
 * Modify an existing plugin
 */
router.post('/plugin/modify', authMiddleware, async (req, res) => {
  try {
    const { prompt, existingCode, pluginSlug } = req.body;
    const userId = req.user.id;

    if (!prompt || !existingCode) {
      return res.status(400).json({
        success: false,
        message: 'prompt and existingCode are required'
      });
    }

    const result = await aiService.modifyPlugin(userId, prompt, existingCode, {
      pluginSlug
    });

    res.json({
      success: true,
      plugin: result.pluginData,
      usage: result.usage,
      creditsDeducted: result.creditsDeducted
    });

  } catch (error) {
    console.error('Plugin Modification Error:', error);

    if (error.message.includes('Insufficient credits')) {
      return res.status(402).json({
        success: false,
        code: 'INSUFFICIENT_CREDITS',
        message: error.message
      });
    }

    res.status(500).json({
      success: false,
      message: error.message || 'Plugin modification failed'
    });
  }
});

/**
 * POST /api/ai/layout/generate
 * Generate layout config
 */
router.post('/layout/generate', authMiddleware, async (req, res) => {
  try {
    const { prompt, configType } = req.body;
    const userId = req.user.id;

    if (!prompt || !configType) {
      return res.status(400).json({
        success: false,
        message: 'prompt and configType are required'
      });
    }

    const result = await aiService.generateLayout(userId, prompt, configType, {
      configType
    });

    res.json({
      success: true,
      config: result.content,
      usage: result.usage,
      creditsDeducted: result.creditsDeducted
    });

  } catch (error) {
    console.error('Layout Generation Error:', error);

    if (error.message.includes('Insufficient credits')) {
      return res.status(402).json({
        success: false,
        code: 'INSUFFICIENT_CREDITS',
        message: error.message
      });
    }

    res.status(500).json({
      success: false,
      message: error.message || 'Layout generation failed'
    });
  }
});

/**
 * POST /api/ai/translate
 * Translate content
 */
router.post('/translate', authMiddleware, async (req, res) => {
  try {
    const { content, targetLanguages } = req.body;
    const userId = req.user.id;

    if (!content || !targetLanguages || !Array.isArray(targetLanguages)) {
      return res.status(400).json({
        success: false,
        message: 'content and targetLanguages (array) are required'
      });
    }

    const result = await aiService.translateContent(userId, content, targetLanguages, {
      sourceLanguage: req.body.sourceLanguage || 'auto'
    });

    res.json({
      success: true,
      translations: result.content,
      usage: result.usage,
      creditsDeducted: result.creditsDeducted
    });

  } catch (error) {
    console.error('Translation Error:', error);

    if (error.message.includes('Insufficient credits')) {
      return res.status(402).json({
        success: false,
        code: 'INSUFFICIENT_CREDITS',
        message: error.message
      });
    }

    res.status(500).json({
      success: false,
      message: error.message || 'Translation failed'
    });
  }
});

/**
 * POST /api/ai/translate-entities
 * Translate entities (products, categories, CMS, etc.) using natural language
 * Example: "Translate all products to French and German"
 */
router.post('/translate-entities', authMiddleware, async (req, res) => {
  try {
    const { prompt, storeId } = req.body;
    const userId = req.user.id;

    if (!prompt) {
      return res.status(400).json({
        success: false,
        message: 'prompt is required'
      });
    }

    // Use AI to parse the prompt and determine what to translate
    const parseResult = await aiService.generate({
      userId,
      operationType: 'translation',
      prompt: `Parse this translation request and return a JSON object with:
{
  "entities": ["products", "categories", "cms_pages", etc.],
  "targetLanguages": ["fr", "de", "es", etc.],
  "filters": {any specific filters mentioned}
}

User request: ${prompt}`,
      systemPrompt: 'You are a translation assistant. Parse the user request and return ONLY valid JSON.',
      maxTokens: 512,
      temperature: 0.3,
      metadata: { type: 'parse-translation-request' }
    });

    let translationRequest;
    try {
      translationRequest = JSON.parse(parseResult.content);
    } catch (error) {
      return res.status(400).json({
        success: false,
        message: 'Could not understand translation request. Please be more specific.'
      });
    }

    // TODO: Implement actual entity translation logic
    // This would:
    // 1. Fetch entities from database based on translationRequest.entities
    // 2. Translate each entity to translationRequest.targetLanguages
    // 3. Save translations back to database
    // 4. Return summary

    // For now, return mock result
    const details = translationRequest.entities.map(entityType => ({
      entityType: entityType.charAt(0).toUpperCase() + entityType.slice(1),
      count: 0, // TODO: Get actual count from database
      languages: translationRequest.targetLanguages
    }));

    res.json({
      success: true,
      data: {
        summary: `Translated ${translationRequest.entities.join(', ')} to ${translationRequest.targetLanguages.join(', ')}`,
        details,
        totalEntities: 0,
        totalTranslations: 0
      },
      creditsDeducted: parseResult.creditsDeducted
    });

  } catch (error) {
    console.error('Entity Translation Error:', error);

    if (error.message.includes('Insufficient credits')) {
      return res.status(402).json({
        success: false,
        code: 'INSUFFICIENT_CREDITS',
        message: error.message
      });
    }

    res.status(500).json({
      success: false,
      message: error.message || 'Entity translation failed'
    });
  }
});

/**
 * POST /api/ai/chat
 * Conversational AI interface - determines intent and executes
 * Like Bolt, Lovable, v0 - user chats naturally
 */
router.post('/chat', authMiddleware, async (req, res) => {
  // Normalize position terms (below → after, above → before)
  const normalizePosition = (pos) => {
    if (!pos) return 'after';
    const lower = pos.toLowerCase();
    if (['below', 'after', 'under', 'beneath', 'bottom'].includes(lower)) return 'after';
    if (['above', 'before', 'over', 'top', 'up'].includes(lower)) return 'before';
    return 'after';
  };

  try {
    let { message, conversationHistory, storeId, modelId, serviceKey, images } = req.body;
    const userId = req.user.id;

    // Resolve store_id from various sources (header takes priority)
    const resolvedStoreId = req.headers['x-store-id'] || req.query.store_id || req.body.store_id || req.body.storeId;

    // Debug: Log ALL store_id sources at start of request
    console.log('🔍 AI Chat - Request started. Store ID sources:', {
      header: req.headers['x-store-id'],
      query: req.query.store_id,
      body_snake: req.body.store_id,
      body_camel: req.body.storeId,
      user_store_id: req.user?.store_id,
      resolved: resolvedStoreId
    });

    // Log model selection with clear visibility
    console.log('═══════════════════════════════════════════════════════════');
    console.log('🤖 AI CHAT REQUEST');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('📍 Model Selection:', { modelId, serviceKey });
    console.log('📝 Message:', message?.substring(0, 100) + (message?.length > 100 ? '...' : ''));
    if (images && images.length > 0) {
      console.log('📷 Images attached:', images.length);
    }

    if (!message) {
      return res.status(400).json({
        success: false,
        message: 'message is required'
      });
    }

    // Generate session ID for tracking this conversation
    const sessionId = req.body.sessionId || `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Process pending confirmations from previous actions
    // This checks if the current message is a correction of the previous AI action
    try {
      const confirmationResult = await aiTrainingService.processNextMessage(sessionId, message);
      if (confirmationResult.hadPending) {
        console.log('📊 Processed pending confirmation:', {
          wasCorrection: confirmationResult.wasCorrection,
          candidateId: confirmationResult.candidateId
        });
      }
    } catch (confirmErr) {
      console.error('Error processing confirmation:', confirmErr);
    }

    // Save user message for learning (async, don't block)
    aiContextService.saveChatMessage({
      userId,
      storeId: resolvedStoreId,
      sessionId,
      role: 'user',
      content: message,
      metadata: { conversationLength: conversationHistory?.length || 0 }
    }).catch(err => console.error('Failed to save user message:', err));

    // Check for pending actions that need confirmation
    let lastPendingAction = null;
    if (conversationHistory && conversationHistory.length > 0) {
      lastPendingAction = [...conversationHistory]
        .reverse()
        .find(msg => msg.role === 'assistant' && msg.data?.type &&
          ['translation_preview', 'styling_preview', 'plugin_confirmation'].includes(msg.data.type));
    }

    // If there's a pending action, let AI determine if this is a confirmation
    if (lastPendingAction && conversationHistory?.length > 0) {
      console.log('🔍 Checking if message is confirmation for pending action...');
      console.log('🎯 Pending action type:', lastPendingAction.data?.type);

      // Handle styling confirmation
      if (lastPendingAction?.data?.action === 'publish_styling') {
        const { configId, pageType, slotId, change } = lastPendingAction.data;
        const ConnectionManager = require('../services/database/ConnectionManager');

        if (!resolvedStoreId) {
          return res.status(400).json({
            success: false,
            message: 'store_id is required for publishing styling changes'
          });
        }

        const tenantDb = await ConnectionManager.getStoreConnection(resolvedStoreId);

        // Publish the draft configuration
        const { error: publishError } = await tenantDb
          .from('slot_configurations')
          .update({
            status: 'published',
            published_at: new Date().toISOString(),
            published_by: userId,
            has_unpublished_changes: false
          })
          .eq('id', configId);

        if (publishError) {
          console.error('Failed to publish styling change:', publishError);
          return res.status(500).json({
            success: false,
            message: 'Failed to publish styling change: ' + publishError.message
          });
        }

        // Deactivate the old published version
        await tenantDb
          .from('slot_configurations')
          .update({ is_active: false })
          .eq('store_id', resolvedStoreId)
          .eq('page_type', pageType)
          .eq('status', 'published')
          .neq('id', configId);

        return res.json({
          success: true,
          message: `✅ Published! The ${change?.property || 'styling'} change for "${slotId}" on the ${pageType} page is now live.\n\nRefresh your storefront to see the changes.`,
          data: {
            type: 'styling_applied',
            configId,
            pageType,
            slotId
          },
          creditsDeducted: 0
        });
      }

      if (lastPendingAction?.data?.action === 'update_labels') {
        // User confirmed - update the translations
        const { translations, matchingKeys, original } = lastPendingAction.data;
        const ConnectionManager = require('../services/database/ConnectionManager');
        const store_id = req.headers['x-store-id'] || req.query.store_id || req.body.store_id || req.body.storeId;

        if (!store_id) {
          return res.status(400).json({
            success: false,
            message: 'store_id is required for updating translations'
          });
        }

        const tenantDb = await ConnectionManager.getStoreConnection(store_id);
        let updatedCount = 0;
        const updates = [];

        for (const [key, langData] of Object.entries(matchingKeys)) {
          for (const targetLang of Object.keys(translations)) {
            try {
              // Check if translation exists using Supabase
              const { data: existing, error: checkError } = await tenantDb
                .from('translations')
                .select('*')
                .eq('key', key)
                .eq('language_code', targetLang)
                .maybeSingle();

              if (existing) {
                // Update existing
                await tenantDb
                  .from('translations')
                  .update({ value: translations[targetLang], updated_at: new Date().toISOString() })
                  .eq('id', existing.id);
              } else {
                // Create new translation
                await tenantDb
                  .from('translations')
                  .insert({
                    key,
                    language_code: targetLang,
                    value: translations[targetLang],
                    category: 'common',
                    type: 'system',
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                  });
              }
              updatedCount++;
              updates.push(`${key} (${targetLang}): ${translations[targetLang]}`);
            } catch (error) {
              console.error(`Failed to update ${key} for ${targetLang}:`, error);
            }
          }
        }

        return res.json({
          success: true,
          message: `✅ Updated ${updatedCount} translation(s)!\n\n${updates.join('\n')}\n\nThe changes are now live on your store. Refresh your pages to see the updates.`,
          data: {
            type: 'translation_applied',
            updatedCount,
            updates
          },
          creditsDeducted: 0 // No AI call needed for confirmation
        });
      }
    }

    // Fetch RAG context to enrich AI understanding
    let ragContext = '';
    try {
      ragContext = await aiContextService.getContextForQuery({
        mode: 'all',
        category: null,
        query: message,
        storeId: resolvedStoreId,
        limit: 5
      });
      console.log('[AI Chat] RAG context loaded:', ragContext ? 'yes' : 'no', ragContext?.length || 0, 'chars');
    } catch (err) {
      console.error('[AI Chat] Failed to load RAG context:', err);
    }

    // Fetch learned examples from successful operations (self-learning)
    let learnedExamples = '';
    try {
      learnedExamples = await aiLearningService.getLearnedExamplesForPrompt();
      if (learnedExamples) {
        console.log('[AI Chat] Learned examples loaded:', learnedExamples.length, 'chars');
      }
    } catch (err) {
      console.error('[AI Chat] Failed to load learned examples:', err);
    }

    // Pre-process: Detect common patterns before AI intent detection (more reliable)
    const lowerMessage = message.toLowerCase();
    let preDetectedIntent = null;

    // Pattern: "add [product] to [category] category" or "add [product] to category [category]"
    const addToCategoryPattern = /add\s+(?:product\s+)?(.+?)\s+to\s+(?:category\s+)?(.+?)(?:\s+category)?$/i;
    const addToCategoryMatch = message.match(addToCategoryPattern);
    if (addToCategoryMatch) {
      const productName = addToCategoryMatch[1].trim();
      const categoryName = addToCategoryMatch[2].trim().replace(/\s*category\s*$/i, '');
      preDetectedIntent = {
        intent: 'category_management',
        details: {
          operation: 'add',
          product_filter: productName,
          category_name: categoryName
        }
      };
      console.log('[AI Chat] Pre-detected category_management intent:', preDetectedIntent);
    }

    // Pattern: "create category [name] and add [product]"
    const createAndAddPattern = /create\s+category\s+(.+?)\s+and\s+add\s+(.+?)(?:\s+to\s+it)?$/i;
    const createAndAddMatch = message.match(createAndAddPattern);
    if (createAndAddMatch) {
      preDetectedIntent = {
        intent: 'category_management',
        details: {
          operation: 'create_and_add',
          category_name: createAndAddMatch[1].trim(),
          product_filter: createAndAddMatch[2].trim()
        }
      };
      console.log('[AI Chat] Pre-detected create_and_add intent:', preDetectedIntent);
    }

    // Pattern: "remove [product] from [category]"
    const removeFromCategoryPattern = /remove\s+(?:product\s+)?(.+?)\s+from\s+(?:category\s+)?(.+?)(?:\s+category)?$/i;
    const removeFromCategoryMatch = message.match(removeFromCategoryPattern);
    if (removeFromCategoryMatch) {
      preDetectedIntent = {
        intent: 'category_management',
        details: {
          operation: 'remove',
          product_filter: removeFromCategoryMatch[1].trim(),
          category_name: removeFromCategoryMatch[2].trim().replace(/\s*category\s*$/i, '')
        }
      };
      console.log('[AI Chat] Pre-detected remove from category intent:', preDetectedIntent);
    }

    // Determine intent from conversation
    const intentPrompt = `Classify this user request for a slot-based e-commerce page builder.

User: "${message}"

${ragContext ? `SYSTEM KNOWLEDGE:\n${ragContext}\n` : ''}
${learnedExamples ? learnedExamples : ''}

COMMON SLOT NAMES (use these exact IDs):
- product_title, product_sku, product_price, price_container
- stock_status, product_short_description, add_to_cart_button
- info_container, content_area, product_gallery_container

INTENTS:
- layout_modify: Moving/repositioning elements (e.g., "move sku above price")
- styling: Changing appearance (e.g., "make title red", "change color")
- analytics_query: DATABASE QUERIES about products, sales, inventory, customers, categories, attributes, settings. USE THIS for any question asking for DATA or LISTING entities like:
  * "which products are out of stock" → query_type: "out_of_stock"
  * "show me out of stock products" → query_type: "out_of_stock"
  * "best selling products" → query_type: "best_selling"
  * "total revenue" → query_type: "revenue"
  * "how many orders today" → query_type: "orders"
  * "low stock items" → query_type: "low_stock"
  * "which categories are live" → query_type: "categories", filters: { status: "active" }
  * "show categories" → query_type: "categories"
  * "list attributes" → query_type: "attributes"
  * "show payment methods" → query_type: "payment_methods"
- job_trigger: Triggering background tasks (e.g., "import from akeneo", "run sync", "start export")
- settings_update: Theme/appearance/catalog settings (e.g., "change breadcrumb color", "hide stock label", "enable inventory tracking")
- admin_entity: Store entity CRUD (e.g., "rename tab", "create coupon", "disable payment method")
- category_management: Adding/removing products to/from categories, OR creating a category and adding products. USE THIS for ANY request about adding products to categories or removing them. Examples:
  * "add all products to snowboard category"
  * "add The Videographer Snowboard to snowboard category" → product_filter: "The Videographer Snowboard", category_name: "snowboard"
  * "add Blue T-Shirt to clothing" → product_filter: "Blue T-Shirt", category_name: "clothing"
  * "remove product X from category Y"
  * "assign products to category"
  * "create category snowboard and add The Videographer to it" → operation: "create_and_add", category_name: "snowboard", product_filter: "The Videographer"
- attribute_management: Create/update attributes and values (e.g., "create attribute Color with values Red, Blue, Green", "add XL to Size attribute")
- product_label_management: Create/update product labels/badges (e.g., "create a Sale label", "add New Arrival label to products")
- product_tab_management: Create/update product detail tabs (e.g., "create a Care Instructions tab", "rename Specs tab to Technical Details")
- custom_option_management: Manage product custom options (e.g., "add text engraving option to product", "create dropdown for gift wrapping")
- customer_management: Customer operations (e.g., "blacklist customer john@example.com", "unblock customer", "get customer details")
- cms_management: Create/update CMS pages and blocks (e.g., "create About Us page", "add shipping info block", "update FAQ page")
- plugin: Creating new features
- translation: Language translations
- image_analysis: When user uploads an image and asks about it (e.g., "use these colors", "what colors are in this", "analyze this design", "copy this layout")
- chat: ONLY for general questions about how to use the system, NOT for data queries

IMPORTANT: If user asks for product data, inventory, sales, or any information from the database - use analytics_query, NOT chat!

For layout_modify, extract:
- sourceElement: what to move (e.g., "title" → "product_title")
- targetElement: move relative to (e.g., "price" → "price_container")
- position: "before" (above) or "after" (below)

For analytics_query, extract:
- query_type: "best_selling", "revenue", "orders", "customers", "inventory", "out_of_stock", "low_stock", "products_by_attribute_set", "product_sales", "top_margin", "sales_by_product", "categories", "attributes", "payment_methods", "shipping_methods", "coupons"
- filters: { period: "today/week/month/year", limit: number, attribute_set: "set name", product_name: "name", status: "active/inactive/all" }
Examples:
- "show out of stock products" → query_type: "out_of_stock"
- "get products with attribute set Snowboards" → query_type: "products_by_attribute_set", filters: { attribute_set: "Snowboards" }
- "what are the sales figures for Blue T-Shirt" → query_type: "product_sales", filters: { product_name: "Blue T-Shirt" }
- "show products with highest margin" → query_type: "top_margin"
- "bestsellers this month" → query_type: "best_selling", filters: { period: "month" }
- "which categories are live" → query_type: "categories", filters: { status: "active" }
- "show all categories" → query_type: "categories"
- "list active categories" → query_type: "categories", filters: { status: "active" }
- "what attributes do we have" → query_type: "attributes"
- "show payment methods" → query_type: "payment_methods"
- "list shipping options" → query_type: "shipping_methods"
- "show active coupons" → query_type: "coupons", filters: { status: "active" }

For job_trigger, extract:
- job_type: "akeneo:import:products", "shopify:import:products", "export:products", etc.
- priority: "normal", "high", "urgent"

For category_management, extract:
- operation: "add", "remove", or "create_and_add" (when creating a new category and adding products)
- category_name: The target category name (e.g., "snowboard", "accessories")
- product_filter: "all", "out_of_stock", or the EXACT product name/SKU from user's message
  * IMPORTANT: If user mentions a specific product name like "The Videographer Snowboard", use that EXACT name as product_filter
  * Examples:
    - "add all products to snowboard" → operation: "add", product_filter: "all", category_name: "snowboard"
    - "add The Videographer Snowboard to snowboard category" → operation: "add", product_filter: "The Videographer Snowboard", category_name: "snowboard"
    - "create category snowboard and add The Videographer to it" → operation: "create_and_add", category_name: "snowboard", product_filter: "The Videographer"
- attribute_set: (optional) Filter by attribute set name (e.g., "add products with attribute set Snowboards to category")

For settings_update, extract:
- setting_path: The setting key. Can be:
  - Top-level: "show_stock_label", "hide_currency_product", "hide_quantity_selector"
  - Nested under theme: "theme.breadcrumb_item_text_color", "theme.primary_color"
- value: the new value (boolean for hide/show, color hex for colors, string for text)

Common settings_update mappings (IMPORTANT - pay attention to value logic):
- "hide stock label" → setting_path: "stock_settings.show_stock_label", value: false
- "show stock label" → setting_path: "stock_settings.show_stock_label", value: true
- "hide currency" → setting_path: "hide_currency_product", value: true
- "show currency" → setting_path: "hide_currency_product", value: false
- "hide quantity selector" → setting_path: "hide_quantity_selector", value: true
- "show quantity selector" → setting_path: "hide_quantity_selector", value: false
- "change breadcrumb color to blue" → setting_path: "theme.breadcrumb_item_text_color", value: "#0000FF"

VALUE LOGIC:
- For "show_*" settings: "show X" = true, "hide X" = false
- For "hide_*" settings: "hide X" = true, "show X" = false

For attribute_management, extract:
- operation: "create_attribute", "update_attribute", "add_value", "remove_value"
- attribute_name: The attribute name (e.g., "Color", "Size")
- values: Array of values to add (e.g., ["Red", "Blue", "Green"])
- value_to_add: Single value to add to existing attribute
- value_to_remove: Value to remove from attribute

For product_label_management, extract:
- operation: "create", "update", "delete", "assign", "unassign"
- label_name: The label name (e.g., "Sale", "New Arrival", "Best Seller")
- label_color: Optional color for the label (e.g., "#FF0000")
- product_filter: Products to assign label to (e.g., "all", "out_of_stock", specific product name)

For product_tab_management, extract:
- operation: "create", "update", "delete"
- tab_name: Current or new tab name
- new_name: New name when renaming
- content: Tab content (optional)

For custom_option_management, extract:
- operation: "create", "update", "delete"
- option_type: "text", "textarea", "dropdown", "checkbox", "radio"
- option_name: Name of the option (e.g., "Engraving Text", "Gift Wrap")
- product_filter: Which products to add option to
- values: For dropdown/radio - the available options

For customer_management, extract:
- operation: "blacklist", "unblacklist", "get_details", "update"
- customer_identifier: Email or customer ID
- reason: Reason for blacklisting (optional)

For cms_management, extract:
- operation: "create_page", "update_page", "delete_page", "create_block", "update_block", "delete_block"
- title: Page or block title
- identifier: URL slug or block identifier
- content: HTML or text content

Return JSON:
{ "intent": "layout_modify", "details": { "sourceElement": "product_title", "targetElement": "price_container", "position": "after" } }

Or for multiple:
{ "intents": [...] }

Return ONLY valid JSON.`;

    // Track all AI conversations for transparency
    const globalAiConversations = [];

    const intentSystemPrompt = 'You are an intent classifier. Return ONLY valid JSON.';
    const intentResult = await aiService.generate({
      userId,
      operationType: 'general',
      modelId, // Use user-selected model
      serviceKey, // Use model-specific service key for pricing
      prompt: intentPrompt,
      systemPrompt: intentSystemPrompt,
      maxTokens: 512,
      temperature: 0.3,
      metadata: { type: 'intent-detection', storeId: resolvedStoreId, modelId }
    });

    // Track intent detection conversation
    globalAiConversations.push({
      step: 'intent-detection',
      provider: intentResult.provider || 'anthropic',
      model: intentResult.usage?.model || modelId || 'claude-3-haiku',
      prompt: intentPrompt,
      systemPrompt: intentSystemPrompt,
      response: intentResult.content,
      tokens: intentResult.usage
    });

    let parsedIntent;
    try {
      const jsonMatch = intentResult.content.match(/\{[\s\S]*\}/);
      parsedIntent = JSON.parse(jsonMatch ? jsonMatch[0] : intentResult.content);
    } catch (error) {
      // Default to chat if can't parse
      parsedIntent = { intent: 'chat', action: 'chat' };
    }

    // Capture ALL intents to master database for training
    const aiTrainingService = require('../services/aiTrainingService');
    const intentCapture = await aiTrainingService.captureTrainingCandidate({
      storeId: resolvedStoreId,
      userId,
      sessionId: sessionId || `session_${Date.now()}`,
      userPrompt: message,
      aiResponse: null, // Will be updated after response
      detectedIntent: parsedIntent.intent || (parsedIntent.intents?.[0]?.intent),
      detectedEntity: parsedIntent.details?.entity || parsedIntent.details?.query_type || parsedIntent.intents?.[0]?.details?.entity,
      detectedOperation: parsedIntent.action || parsedIntent.details?.operation,
      actionTaken: null, // Will be updated after action
      confidenceScore: parsedIntent.confidence || 0.7,
      metadata: {
        modelId,
        fullIntent: parsedIntent,
        isMultiIntent: !!(parsedIntent.intents && parsedIntent.intents.length > 1)
      }
    }).catch(err => {
      console.error('[AI Training] Failed to capture intent:', err);
      return { captured: false };
    });

    // Store candidateId for later updates
    const trainingCandidateId = intentCapture?.candidateId;

    // Handle MULTIPLE intents if AI detected them
    if (parsedIntent.intents && Array.isArray(parsedIntent.intents) && parsedIntent.intents.length > 1) {
      console.log('[AI Chat] ===========================================');
      console.log('[AI Chat] Detected MULTIPLE intents:', parsedIntent.intents.length);
      console.log('[AI Chat] FULL INTENTS ARRAY:', JSON.stringify(parsedIntent.intents, null, 2));
      console.log('[AI Chat] ===========================================');

      const results = [];
      let totalCredits = intentResult.creditsDeducted;
      const ConnectionManager = require('../services/database/ConnectionManager');

      if (!resolvedStoreId) {
        return res.status(400).json({
          success: false,
          message: 'store_id is required for multi-intent operations'
        });
      }

      const tenantDb = await ConnectionManager.getStoreConnection(resolvedStoreId);

      // Get the page type (use first intent that specifies it, default to 'product')
      const pageType = parsedIntent.intents.find(i => i.details?.pageType)?.details?.pageType || 'product';

      // Fetch current slot configuration once for all operations
      let { data: slotConfig, error: fetchError } = await tenantDb
        .from('slot_configurations')
        .select('*')
        .eq('store_id', resolvedStoreId)
        .eq('page_type', pageType)
        .eq('status', 'draft')
        .order('version_number', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!slotConfig && !fetchError) {
        const { data: publishedConfig } = await tenantDb
          .from('slot_configurations')
          .select('*')
          .eq('store_id', resolvedStoreId)
          .eq('page_type', pageType)
          .eq('status', 'published')
          .order('version_number', { ascending: false })
          .limit(1)
          .maybeSingle();
        slotConfig = publishedConfig;
      }

      if (!slotConfig) {
        return res.json({
          success: true,
          message: `I couldn't find a layout configuration for the ${pageType} page. Please save a layout in the Editor first.`,
          data: { type: 'multi_intent_error', reason: 'no_config_found' },
          creditsDeducted: totalCredits
        });
      }

      // Work with a copy of the configuration
      let workingConfig = JSON.parse(JSON.stringify(slotConfig.configuration || {}));
      let slots = workingConfig.slots || {};

      console.log('[AI Chat Multi] Slots count:', Object.keys(slots).length);

      // Auto-recover empty slots from default config
      if (Object.keys(slots).length === 0) {
        console.log('[AI Chat Multi] Empty slots, attempting auto-recovery...');
        try {
          const path = require('path');
          const configsDir = path.resolve(__dirname, '../../../src/components/editor/slot/configs');
          const configMap = {
            'product': { file: 'product-config.js', export: 'productConfig' },
            'category': { file: 'category-config.js', export: 'categoryConfig' },
            'cart': { file: 'cart-config.js', export: 'cartConfig' },
            'checkout': { file: 'checkout-config.js', export: 'checkoutConfig' },
            'header': { file: 'header-config.js', export: 'headerConfig' }
          };

          const configInfo = configMap[pageType] || { file: `${pageType}-config.js`, export: `${pageType}Config` };
          const configPath = path.join(configsDir, configInfo.file);
          const configModule = await import(configPath);
          const defaultConfig = configModule[configInfo.export];

          if (defaultConfig?.slots) {
            console.log(`[AI Chat Multi] Loaded ${Object.keys(defaultConfig.slots).length} slots from ${configInfo.file}`);
            slots = defaultConfig.slots;
            workingConfig.slots = slots;

            // Save recovered slots to database
            await tenantDb
              .from('slot_configurations')
              .update({ configuration: workingConfig, updated_at: new Date().toISOString() })
              .eq('id', slotConfig.id);
          }
        } catch (err) {
          console.error('[AI Chat Multi] Auto-recovery failed:', err.message);
        }
      }

      console.log('[AI Chat Multi] Available slots:', Object.keys(slots).slice(0, 10));

      // Get list of available slot names for AI
      const availableSlots = Object.keys(slots);
      console.log('[AI Chat Multi] Available slots:', availableSlots);

      // AI-driven slot resolution - let AI figure out what user means
      const resolveSlotIdWithAI = async (userTerm) => {
        if (!userTerm) return null;
        const lower = userTerm.toLowerCase().trim();

        // 1. Direct match first (exact or with underscores)
        if (slots[userTerm]) return userTerm;
        if (slots[lower]) return lower;
        if (slots[lower.replace(/\s+/g, '_')]) return lower.replace(/\s+/g, '_');

        // 2. Simple contains match
        for (const slotId of availableSlots) {
          if (slotId.toLowerCase().includes(lower) || lower.includes(slotId.toLowerCase().replace(/_/g, ''))) {
            return slotId;
          }
        }

        // 3. AI-driven matching for ambiguous terms
        console.log(`[AI Chat Multi] Using AI to resolve "${userTerm}" from slots:`, availableSlots.slice(0, 15));
        const matchPrompt = `Available slots: ${availableSlots.join(', ')}

User said: "${userTerm}"

Which slot matches? Reply with JUST the slot ID, nothing else. If no match, reply "none".`;

        try {
          const matchResult = await aiService.generate({
            userId,
            operationType: 'general',
            modelId,
            serviceKey,
            prompt: matchPrompt,
            systemPrompt: 'Reply with only the matching slot ID. Nothing else.',
            maxTokens: 30,
            temperature: 0,
            metadata: { type: 'slot-matching', storeId: resolvedStoreId, modelId }
          });
          totalCredits += matchResult.creditsDeducted;

          const matched = matchResult.content.trim().toLowerCase();
          console.log(`[AI Chat Multi] AI matched "${userTerm}" to:`, matched);

          // Find the actual slot ID (case-insensitive)
          const actualSlot = availableSlots.find(s => s.toLowerCase() === matched);
          if (actualSlot && slots[actualSlot]) return actualSlot;
        } catch (e) {
          console.error('[AI Chat Multi] AI slot matching failed:', e.message);
        }

        return null;
      };

      // Sync wrapper for simple cases, async for AI
      const resolveSlotId = (name) => {
        if (!name) return null;
        const lower = name.toLowerCase().trim();

        // Quick direct matches
        if (slots[name]) return name;
        if (slots[lower]) return lower;
        if (slots[lower.replace(/\s+/g, '_')]) return lower.replace(/\s+/g, '_');

        // Simple contains
        for (const slotId of availableSlots) {
          if (slotId.toLowerCase().includes(lower) || lower.includes(slotId.toLowerCase().replace(/_/g, ''))) {
            return slotId;
          }
        }

        return null; // Will use AI fallback
      };

      // Get friendly name for slot
      const getFriendlyName = (slotId) => {
        const slot = slots[slotId];
        return slot?.metadata?.displayName || slotId.replace(/_/g, ' ');
      };

      // Find suggestions for unmatched element
      const getSuggestions = (name) => {
        if (!name) return [];
        const lower = name.toLowerCase();
        return availableSlots
          .filter(s => s.toLowerCase().includes(lower) || lower.includes(s.toLowerCase().replace(/_/g, '')))
          .slice(0, 3)
          .map(s => getFriendlyName(s));
      };

      // Generate slot grid visualization for AI understanding
      const generateSlotGridMap = () => {
        const containers = {};
        // Group slots by parent
        Object.entries(slots).forEach(([id, slot]) => {
          const parent = slot.parentId || 'root';
          if (!containers[parent]) containers[parent] = [];
          containers[parent].push({
            id,
            row: slot.position?.row ?? 999,
            col: slot.position?.col ?? 1,
            colSpan: typeof slot.colSpan === 'object' ? slot.colSpan.default : slot.colSpan,
            name: getFriendlyName(id)
          });
        });
        // Sort by row, then col
        Object.values(containers).forEach(slots => {
          slots.sort((a, b) => a.row - b.row || a.col - b.col);
        });
        return containers;
      };

      // Process each intent
      for (const singleIntent of parsedIntent.intents) {
        console.log('[AI Chat] Processing multi-intent:', singleIntent.intent, singleIntent.details);
        let subResult = { success: false, message: '', data: null };

        try {
          // Handle layout_modify intent
          if (singleIntent.intent === 'layout_modify') {
            const sourceElement = singleIntent.details?.sourceElement;
            const targetElement = singleIntent.details?.targetElement;
            const rawPosition = singleIntent.details?.position || 'after';
            const position = normalizePosition(rawPosition);
            console.log('[AI Chat Multi] Position normalized:', rawPosition, '->', position);

            // Log grid structure for debugging
            const gridMap = generateSlotGridMap();
            console.log('[AI Chat Multi] Current slot grid:', JSON.stringify(gridMap, null, 2));

            // Use AI-driven resolution for both elements
            const sourceSlotId = resolveSlotId(sourceElement) || await resolveSlotIdWithAI(sourceElement);
            const targetSlotId = resolveSlotId(targetElement) || await resolveSlotIdWithAI(targetElement);
            console.log('[AI Chat Multi] layout_modify - resolved:', { sourceElement, sourceSlotId, targetElement, targetSlotId });

            if (sourceSlotId && targetSlotId && slots[sourceSlotId] && slots[targetSlotId]) {
              const sourceSlot = slots[sourceSlotId];
              const targetSlot = slots[targetSlotId];

              if (sourceSlot.parentId === targetSlot.parentId) {
                // Get siblings and reorder
                const parentId = sourceSlot.parentId;
                const siblingSlots = Object.entries(slots)
                  .filter(([id, slot]) => slot.parentId === parentId)
                  .sort((a, b) => (a[1].position?.row ?? 999) - (b[1].position?.row ?? 999));

                const currentOrder = siblingSlots.map(([id]) => id);
                const sourceIndex = currentOrder.indexOf(sourceSlotId);
                const targetIndex = currentOrder.indexOf(targetSlotId);

                if (sourceIndex !== -1 && targetIndex !== -1) {
                  currentOrder.splice(sourceIndex, 1);
                  let newTargetIndex = currentOrder.indexOf(targetSlotId);
                  if (position === 'after') newTargetIndex += 1;
                  currentOrder.splice(newTargetIndex, 0, sourceSlotId);

                  // Update row positions
                  currentOrder.forEach((slotId, index) => {
                    if (slots[slotId] && slots[slotId].position) {
                      slots[slotId].position.row = index + 1;
                    }
                  });

                  subResult = {
                    success: true,
                    message: `Moved ${sourceElement} ${position} ${targetElement}`,
                    data: { type: 'layout_modify', action: 'move', source: sourceSlotId, target: targetSlotId }
                  };
                }
              } else {
                // Cross-container move - move source to target's container
                console.log('[AI Chat Multi] Cross-container move:', sourceSlot.parentId, '->', targetSlot.parentId);

                const oldParentId = sourceSlot.parentId;
                const newParentId = targetSlot.parentId;

                // Update source slot's parent
                sourceSlot.parentId = newParentId;

                // Get siblings in new container and insert source
                const newSiblings = Object.entries(slots)
                  .filter(([id, slot]) => slot.parentId === newParentId && id !== sourceSlotId)
                  .sort((a, b) => (a[1].position?.row ?? 999) - (b[1].position?.row ?? 999));

                const newOrder = newSiblings.map(([id]) => id);
                const targetIndex = newOrder.indexOf(targetSlotId);
                const insertAt = position === 'after' ? targetIndex + 1 : targetIndex;
                newOrder.splice(insertAt, 0, sourceSlotId);

                // Update row positions in new container
                newOrder.forEach((slotId, index) => {
                  if (slots[slotId]?.position) {
                    slots[slotId].position.row = index + 1;
                  }
                });

                // Reorder remaining slots in old container
                const oldSiblings = Object.entries(slots)
                  .filter(([id, slot]) => slot.parentId === oldParentId)
                  .sort((a, b) => (a[1].position?.row ?? 999) - (b[1].position?.row ?? 999));

                oldSiblings.forEach(([slotId], index) => {
                  if (slots[slotId]?.position) {
                    slots[slotId].position.row = index + 1;
                  }
                });

                subResult = {
                  success: true,
                  message: `Moved ${sourceElement} ${position} ${targetElement}`,
                  data: { type: 'layout_modify', action: 'move', source: sourceSlotId, target: targetSlotId, crossContainer: true }
                };
              }
            } else {
              // Find which element(s) couldn't be found
              const notFound = [];
              if (!sourceSlotId || !slots[sourceSlotId]) notFound.push({ name: sourceElement, suggestions: getSuggestions(sourceElement) });
              if (!targetSlotId || !slots[targetSlotId]) notFound.push({ name: targetElement, suggestions: getSuggestions(targetElement) });

              subResult = {
                success: false,
                notFound,
                needsClarification: true
              };
            }
          }
          // Handle styling intent
          else if (singleIntent.intent === 'styling') {
            const element = singleIntent.details?.element;
            let property = singleIntent.details?.property || '';
            let value = singleIntent.details?.value || '';

            console.log('[AI Chat Multi] ===================');
            console.log('[AI Chat Multi] Styling intent RAW:', JSON.stringify(singleIntent));
            console.log('[AI Chat Multi] Styling intent PARSED:', { element, property, value });

            // Smart detection: if value looks like a color and no property, assume color
            const colorNames = ['red', 'blue', 'green', 'orange', 'yellow', 'purple', 'pink', 'gray', 'black', 'white'];
            if (!property && value && colorNames.includes(value.toLowerCase())) {
              property = 'color';
            }
            // If property is the color name, swap them
            if (colorNames.includes(property?.toLowerCase()) && !value) {
              value = property;
              property = 'color';
            }

            // Use AI-driven resolution for element
            const targetSlotId = resolveSlotId(element) || await resolveSlotIdWithAI(element);
            console.log('[AI Chat Multi] Resolved slot:', targetSlotId, 'from element:', element);

            if (targetSlotId && slots[targetSlotId]) {
              const slot = slots[targetSlotId];
              const propLower = property?.toLowerCase() || 'color'; // Default to color
              const friendlyName = getFriendlyName(targetSlotId);

              // Initialize styles if needed
              if (!slot.styles) slot.styles = {};

              // Handle color properties
              if (propLower.includes('color') && !propLower.includes('background')) {
                const colorValue = value?.toLowerCase().replace(/\s+/g, '');
                if (colorValue) {
                  const tailwindColors = {
                    'red': 'text-red-500', 'blue': 'text-blue-500', 'green': 'text-green-500',
                    'orange': 'text-orange-500', 'yellow': 'text-yellow-500', 'purple': 'text-purple-500',
                    'pink': 'text-pink-500', 'gray': 'text-gray-500', 'black': 'text-black', 'white': 'text-white'
                  };
                  const tailwindClass = tailwindColors[colorValue];
                  if (tailwindClass) {
                    const existingClasses = (slot.className || '').split(' ');
                    const filteredClasses = existingClasses.filter(c => !c.match(/^text-(red|blue|green|orange|yellow|purple|pink|gray|black|white)(-\d+)?$/));
                    slot.className = [...filteredClasses, tailwindClass].join(' ').trim();
                    // Remove conflicting inline style
                    if (slot.styles?.color) delete slot.styles.color;
                    console.log('[AI Chat Multi] Applied tailwind class:', tailwindClass);
                  } else {
                    slot.styles.color = value;
                    // Remove conflicting tailwind classes when using inline style
                    const existingClasses = (slot.className || '').split(' ');
                    slot.className = existingClasses.filter(c => !c.match(/^text-(red|blue|green|orange|yellow|purple|pink|gray|black|white)(-\d+)?$/)).join(' ').trim();
                  }
                  subResult = { success: true, message: `${friendlyName} is now ${value}`, data: { type: 'styling', element: targetSlotId, property: 'color', value } };
                } else {
                  subResult = { success: false, message: `No color value specified for ${element}`, needsClarification: true };
                }
              } else if (propLower.includes('background')) {
                slot.styles.backgroundColor = value;
                subResult = { success: true, message: `Changed ${friendlyName} background to ${value}`, data: { type: 'styling', element: targetSlotId, property: 'backgroundColor', value } };
              } else if (propLower.includes('size') || propLower.includes('font')) {
                slot.styles.fontSize = value;
                subResult = { success: true, message: `Changed ${friendlyName} font size to ${value}`, data: { type: 'styling', element: targetSlotId, property: 'fontSize', value } };
              } else {
                slot.styles[property] = value;
                subResult = { success: true, message: `Updated ${friendlyName} ${property} to ${value}`, data: { type: 'styling', element: targetSlotId, property, value } };
              }
            } else {
              const suggestions = getSuggestions(element);
              subResult = {
                success: false,
                notFound: [{ name: element, suggestions }],
                needsClarification: true
              };
            }
          }
          // Other intents
          else {
            subResult = { success: false, message: `I'll need to handle "${singleIntent.intent}" separately.`, data: null };
          }

          results.push(subResult);
        } catch (err) {
          console.error('[AI Chat] Error processing sub-intent:', err);
          results.push({ success: false, message: `Something went wrong with that change.`, error: err.message });
        }
      }

      // Update configuration with successful changes
      const successfulChanges = results.filter(r => r.success);
      console.log('[AI Chat Multi] Results:', JSON.stringify(results, null, 2));
      console.log('[AI Chat Multi] Successful changes count:', successfulChanges.length);

      if (successfulChanges.length > 0) {
        workingConfig.slots = slots;
        workingConfig.metadata = {
          ...workingConfig.metadata,
          lastModified: new Date().toISOString(),
          lastModifiedBy: 'AI Assistant',
          lastChanges: successfulChanges.map(r => r.message)
        };

        // Log what we're about to save for debugging
        console.log('[AI Chat Multi] Saving configuration...');
        console.log('[AI Chat Multi] Sample slot (product_title):', JSON.stringify(slots['product_title'], null, 2));

        const { error: updateError } = await tenantDb
          .from('slot_configurations')
          .update({
            configuration: workingConfig,
            updated_at: new Date().toISOString()
          })
          .eq('id', slotConfig.id);

        if (updateError) {
          console.error('[AI Chat] Failed to save multi-intent changes:', updateError);
        } else {
          console.log('[AI Chat Multi] Configuration saved successfully!');
        }
      }

      // Let AI generate varied, natural response
      const successCount = successfulChanges.length;
      const needsClarification = results.filter(r => r.needsClarification);
      const allNotFound = needsClarification.flatMap(r => r.notFound || []);

      // Build context for AI - check what needs clarification
      const whatWasDone = successfulChanges.map(r => r.message).join('; ');

      // Check for incomplete layout commands (missing target)
      const incompleteLayout = parsedIntent.intents.find(i =>
        i.intent === 'layout_modify' && !i.details?.targetElement
      );

      // Build clarification questions
      let clarificationNeeded = [];
      if (incompleteLayout) {
        const source = incompleteLayout.details?.sourceElement || 'element';
        const position = incompleteLayout.details?.position || 'move';
        clarificationNeeded.push(`move ${source} ${position} what?`);
      }
      allNotFound.forEach(nf => {
        if (nf.name) {
          clarificationNeeded.push(`couldn't find "${nf.name}"${nf.suggestions?.length ? ` - did you mean ${nf.suggestions[0]}?` : ''}`);
        }
      });

      // Generate response based on what happened
      let responsePrompt;
      if (clarificationNeeded.length > 0 && successCount > 0) {
        // Some things worked, some need clarification
        responsePrompt = `Done: ${whatWasDone}
But I need clarification: ${clarificationNeeded.join(', ')}
Ask the user to clarify in a natural way. Keep it brief.`;
      } else if (clarificationNeeded.length > 0) {
        // Nothing worked, need clarification
        responsePrompt = `I need more info: ${clarificationNeeded.join(', ')}
Ask the user to be more specific. For example, "move X below Y" needs both elements. Keep it brief and helpful.`;
      } else {
        // Everything worked
        responsePrompt = `Changes made: ${whatWasDone || 'none'}
Confirm in 1 sentence. MUST mention the specific changes. Keep it casual.`;
      }

      const responseResult = await aiService.generate({
        userId,
        operationType: 'general',
        modelId, // Use user-selected model
        serviceKey, // Use model-specific service key for pricing
        prompt: responsePrompt,
        systemPrompt: clarificationNeeded.length > 0
          ? 'Ask for clarification naturally. Be helpful, suggest examples.'
          : 'Mention the SPECIFIC changes made. One casual sentence.',
        maxTokens: clarificationNeeded.length > 0 ? 80 : 40,
        temperature: 0.7,
        metadata: { type: 'response', storeId: resolvedStoreId, modelId }
      });
      totalCredits += responseResult.creditsDeducted;

      // Save AI response for learning
      aiContextService.saveChatMessage({
        userId,
        storeId: resolvedStoreId,
        sessionId,
        role: 'assistant',
        content: responseResult.content,
        intent: 'multi_intent',
        operation: parsedIntent.intents.map(i => i.intent).join(','),
        wasSuccessful: successCount > 0,
        metadata: {
          intents: parsedIntent.intents,
          successCount,
          failedCount: results.length - successCount,
          clarificationNeeded: clarificationNeeded.length > 0
        }
      }).catch(err => console.error('Failed to save AI response:', err));

      return res.json({
        success: successCount > 0,
        message: responseResult.content,
        data: {
          type: 'multi_intent',
          pageType,
          intents: parsedIntent.intents,
          results: results,
          successCount,
          needsClarification: needsClarification.length
        },
        creditsDeducted: totalCredits
      });
    }

    // Single intent processing (existing behavior)
    const intent = parsedIntent;
    console.log('[AI Chat] Detected intent:', JSON.stringify(intent));
    console.log('[AI Chat] Store ID:', resolvedStoreId);

    // Execute based on intent
    let responseData = null;
    let creditsUsed = intentResult.creditsDeducted;

    if (intent.intent === 'plugin' && intent.action === 'generate') {
      // Check if this is a confirmed plugin generation request
      const isConfirmed = req.body.confirmedPlugin === true;

      if (!isConfirmed) {
        // Return confirmation request - let AI generate the confirmation message
        const confirmPrompt = `User wants: "${message}"
This requires generating a plugin which costs credits.
Generate a brief, friendly message asking if they want to proceed. Mention it will create custom functionality for their store.`;

        const confirmResult = await aiService.generate({
          userId,
          operationType: 'general',
          modelId, // Use user-selected model
          serviceKey, // Use model-specific service key
          prompt: confirmPrompt,
          systemPrompt: 'Be brief and helpful. Ask for confirmation to generate a plugin. No markdown, no emojis.',
          maxTokens: 100,
          temperature: 0.7,
          metadata: { type: 'plugin-confirmation', storeId, modelId }
        });
        creditsUsed += confirmResult.creditsDeducted;

        return res.json({
          success: true,
          message: confirmResult.content,
          data: {
            type: 'plugin_confirmation',
            prompt: message,
            category: intent.details?.category || 'general'
          },
          creditsDeducted: creditsUsed
        });
      }

      // Generate plugin (confirmed)
      const pluginResult = await aiService.generatePlugin(userId, message, {
        category: intent.details?.category || 'general',
        storeId,
        modelId, // Use user-selected model for plugin generation
        serviceKey
      });

      responseData = {
        type: 'plugin',
        plugin: pluginResult.pluginData
      };
      creditsUsed += pluginResult.creditsDeducted;

      res.json({
        success: true,
        message: `I've created a plugin for you! Here's what it does:\n\n${pluginResult.pluginData.explanation || pluginResult.pluginData.description}`,
        data: responseData,
        creditsDeducted: creditsUsed
      });

    } else if (intent.intent === 'translation') {
      // AI-DRIVEN TRANSLATION HANDLER
      const ConnectionManager = require('../services/database/ConnectionManager');
      const translationService = require('../services/translation-service');

      // Debug: Log all store_id sources
      console.log('🔍 AI Chat Translation - Store ID sources:', {
        header: req.headers['x-store-id'],
        query: req.query.store_id,
        body_snake: req.body.store_id,
        body_camel: req.body.storeId,
        user_store_id: req.user?.store_id
      });

      const store_id = req.headers['x-store-id'] || req.query.store_id || req.body.store_id || req.body.storeId;
      console.log('🎯 AI Chat Translation - Using store_id:', store_id);

      if (!store_id) {
        return res.status(400).json({
          success: false,
          message: 'store_id is required for translations'
        });
      }

      const tenantDb = await ConnectionManager.getStoreConnection(store_id);

      // Fetch active languages from tenant DB using Supabase
      const { data: activeLanguages, error: langError } = await tenantDb
        .from('languages')
        .select('code, name, native_name, is_default, is_active')
        .eq('is_active', true)
        .order('is_default', { ascending: false })
        .order('name', { ascending: true });

      if (langError || !activeLanguages) {
        return res.status(500).json({
          success: false,
          message: 'Failed to fetch languages'
        });
      }

      const languageContext = activeLanguages.map(lang =>
        `${lang.name} (${lang.code})${lang.is_default ? ' [default]' : ''}`
      ).join(', ');

      const defaultLanguage = activeLanguages.find(lang => lang.is_default)?.code || 'en';

      // Step 1: Let AI analyze the request and search for relevant translations
      const analysisPrompt = `The user wants to translate something in their e-commerce store.

User request: "${message}"
Previous context: ${JSON.stringify(conversationHistory?.slice(-2) || [])}

STORE LANGUAGE CONTEXT:
- Active languages: ${languageContext}
- Default language: ${defaultLanguage}
- Total active: ${activeLanguages.length} language(s)

Analyze this request and provide:
1. What text/label they want to translate (e.g., "Add to Cart", "Buy Now")
2. Target language codes from the ACTIVE languages list above (e.g., ["fr", "es", "de"])
3. Suggested translation keys to search for (e.g., ["add_to_cart", "addtocart", "add to cart"])

IMPORTANT: Only suggest languages that are in the active languages list above!

Return JSON:
{
  "textToTranslate": "Add to Cart",
  "targetLanguages": ["fr", "es"],
  "searchTerms": ["add_to_cart", "add to cart", "addtocart", "cart.add"],
  "needsClarification": false,
  "clarificationQuestion": null,
  "inactiveLanguageWarning": null
}

If the user requests a language that's NOT in the active list, set inactiveLanguageWarning with a helpful message.
If you need to ask for clarification (missing language or unclear text), set needsClarification: true`;

      const analysisResult = await aiService.generate({
        userId,
        operationType: 'general',
        modelId,
        serviceKey,
        prompt: analysisPrompt,
        systemPrompt: 'You are an AI translation assistant. Analyze user requests and extract structured information. Return ONLY valid JSON.',
        maxTokens: 512,
        temperature: 0.3,
        metadata: { type: 'translation-analysis', storeId: resolvedStoreId, modelId }
      });

      let analysis;
      try {
        const jsonMatch = analysisResult.content.match(/\{[\s\S]*\}/);
        analysis = JSON.parse(jsonMatch ? jsonMatch[0] : analysisResult.content);
      } catch (error) {
        console.error('Failed to parse analysis:', error);
        analysis = { needsClarification: true, clarificationQuestion: "I'm not sure what you'd like to translate. Could you be more specific?" };
      }

      creditsUsed += analysisResult.creditsDeducted;

      // Step 2: Check for inactive language warning
      if (analysis.inactiveLanguageWarning) {
        return res.json({
          success: true,
          message: `${analysis.inactiveLanguageWarning}\n\nYour active languages are: ${languageContext}\n\nWould you like to activate a new language, or choose from the active ones?`,
          data: {
            type: 'language_warning',
            activeLanguages: activeLanguages.map(l => ({ code: l.code, name: l.name }))
          },
          creditsDeducted: creditsUsed
        });
      }

      // Step 3: If AI needs clarification, ask the user
      if (analysis.needsClarification) {
        return res.json({
          success: true,
          message: analysis.clarificationQuestion || "Could you provide more details about what you'd like to translate?",
          data: { type: 'clarification' },
          creditsDeducted: creditsUsed
        });
      }

      // Step 3: Search for matching translation keys using AI's search terms
      const searchTerms = analysis.searchTerms || [analysis.textToTranslate];
      const searchConditions = searchTerms.map((_, idx) =>
        `(LOWER(value) LIKE $${idx * 2 + 1} OR LOWER(key) LIKE $${idx * 2 + 2})`
      ).join(' OR ');

      const searchBindings = searchTerms.flatMap(term => [
        `%${term.toLowerCase()}%`,
        `%${term.replace(/\s+/g, '_').toLowerCase()}%`
      ]);

      // Search translations using Supabase (simplified - search by first term)
      const firstTerm = searchTerms[0] || '';
      const { data: matchingKeys, error: searchError } = await tenantDb
        .from('translations')
        .select('key, value, language_code')
        .or(`value.ilike.%${firstTerm.toLowerCase()}%,key.ilike.%${firstTerm.replace(/\s+/g, '_').toLowerCase()}%`)
        .order('language_code')
        .order('key')
        .limit(20);

      if (searchError) {
        console.error('Translation search error:', searchError);
        return res.status(500).json({
          success: false,
          message: 'Failed to search translations'
        });
      }

      // Step 4: Let AI decide which keys are most relevant
      if (matchingKeys.length > 0) {
        const aiDecisionPrompt = `The user wants to translate: "${analysis.textToTranslate}"

I found these translation keys in the database:
${matchingKeys.map(k => `- ${k.key}: "${k.value}" (${k.language_code})`).join('\n')}

Which keys should be updated? Return JSON:
{
  "relevantKeys": ["product.add_to_cart", "common.addToCart"],
  "reasoning": "These keys match the 'add to cart' button functionality"
}`;

        const decisionResult = await aiService.generate({
          userId,
          operationType: 'general',
          modelId,
          serviceKey,
          prompt: aiDecisionPrompt,
          systemPrompt: 'You are a translation key expert. Identify the most relevant keys. Return ONLY valid JSON.',
          maxTokens: 256,
          temperature: 0.2,
          metadata: { type: 'key-selection', storeId: resolvedStoreId, modelId }
        });

        let decision;
        try {
          const jsonMatch = decisionResult.content.match(/\{[\s\S]*\}/);
          decision = JSON.parse(jsonMatch ? jsonMatch[0] : decisionResult.content);
        } catch (error) {
          // Fallback: use all unique keys
          decision = {
            relevantKeys: [...new Set(matchingKeys.map(k => k.key))],
            reasoning: 'Using all matching keys'
          };
        }

        creditsUsed += decisionResult.creditsDeducted;

        // Step 5: Generate translations for target languages
        const results = {};
        for (const targetLang of analysis.targetLanguages) {
          try {
            const translated = await translationService._translateWithClaude(
              analysis.textToTranslate,
              'en',
              targetLang,
              { type: 'button', location: 'general' }
            );
            results[targetLang] = translated;
          } catch (error) {
            console.error(`Translation to ${targetLang} failed:`, error);
            results[targetLang] = `[Translation failed]`;
          }
        }

        // Step 6: Show preview with AI's reasoning
        const keyGroups = {};
        decision.relevantKeys.forEach(key => {
          const keyData = matchingKeys.filter(k => k.key === key);
          if (keyData.length > 0) {
            keyGroups[key] = keyData.map(k => ({ lang: k.language_code, value: k.value }));
          }
        });

        const translationsList = Object.entries(results)
          .map(([lang, translation]) => `**${lang.toUpperCase()}**: ${translation}`)
          .join('\n');

        const keysInfo = Object.entries(keyGroups).map(([key, langs]) =>
          `- \`${key}\` (currently in ${langs.map(l => l.lang).join(', ')})`
        ).join('\n');

        return res.json({
          success: true,
          message: `I found these translation keys for "${analysis.textToTranslate}":\n\n${keysInfo}\n\n${decision.reasoning}\n\n**Suggested translations:**\n${translationsList}\n\nWould you like me to update these? Reply "yes" to proceed.`,
          data: {
            type: 'translation_preview',
            original: analysis.textToTranslate,
            translations: results,
            matchingKeys: keyGroups,
            action: 'update_labels',
            aiReasoning: decision.reasoning
          },
          creditsDeducted: creditsUsed
        });
      }

      // No matches found - let AI suggest next steps
      const noMatchPrompt = `The user wants to translate "${analysis.textToTranslate}" but I couldn't find matching translation keys in the database.

Suggest helpful next steps. Be friendly and actionable.`;

      const suggestionResult = await aiService.generate({
        userId,
        operationType: 'general',
        modelId,
        serviceKey,
        prompt: noMatchPrompt,
        systemPrompt: 'You are a helpful translation assistant.',
        maxTokens: 256,
        temperature: 0.7,
        metadata: { type: 'translation-suggestion', storeId: resolvedStoreId, modelId }
      });

      res.json({
        success: true,
        message: suggestionResult.content,
        data: { type: 'suggestion' },
        creditsDeducted: creditsUsed + suggestionResult.creditsDeducted
      });

    } else if (intent.intent === 'layout') {
      // Generate layout
      const layoutResult = await aiService.generateLayout(userId, message, intent.details?.configType || 'homepage', {
        storeId
      });

      responseData = {
        type: 'layout',
        configType: intent.details?.configType || 'homepage',
        config: layoutResult.content
      };
      creditsUsed += layoutResult.creditsDeducted;

      res.json({
        success: true,
        message: `I've generated a layout configuration for your ${intent.details?.configType || 'homepage'}. You can preview it below.`,
        data: responseData,
        creditsDeducted: creditsUsed
      });

    } else if (intent.intent === 'layout_modify') {
      // Handle layout modifications (reorder, move, swap, remove elements)
      console.log('[AI Chat] Entering layout_modify handler');
      console.log('[AI Chat] Layout modify details:', JSON.stringify(intent.details));
      const ConnectionManager = require('../services/database/ConnectionManager');

      if (!resolvedStoreId) {
        return res.status(400).json({
          success: false,
          message: 'store_id is required for layout modifications'
        });
      }

      const tenantDb = await ConnectionManager.getStoreConnection(resolvedStoreId);
      const pageType = intent.details?.pageType || 'product';
      const action = intent.details?.action || 'move';
      const sourceElement = intent.details?.sourceElement;
      const targetElement = intent.details?.targetElement;
      const rawPosition = intent.details?.position || 'after';
      const position = normalizePosition(rawPosition);
      console.log('[AI Chat] Position normalized:', rawPosition, '->', position);

      // Check if we're missing required info for the move
      if (!targetElement && sourceElement) {
        // Ask for clarification - what should it be moved relative to?
        const clarifyPrompt = `User wants to move "${sourceElement}" ${position} something, but didn't specify what.
Ask them to clarify. Example: "move ${sourceElement} ${position} [other element]"
Keep it brief and helpful.`;

        const clarifyResult = await aiService.generate({
          userId,
          operationType: 'general',
          modelId,
          serviceKey,
          prompt: clarifyPrompt,
          systemPrompt: 'Ask for clarification naturally. Be helpful.',
          maxTokens: 60,
          temperature: 0.7,
          metadata: { type: 'clarification', storeId: resolvedStoreId, modelId }
        });
        creditsUsed += clarifyResult.creditsDeducted;

        return res.json({
          success: true,
          message: clarifyResult.content,
          data: { type: 'layout_clarification', missing: 'targetElement', sourceElement, position },
          creditsDeducted: creditsUsed
        });
      }

      // Fetch current slot configuration (draft first, then published)
      let { data: slotConfig, error: fetchError } = await tenantDb
        .from('slot_configurations')
        .select('*')
        .eq('store_id', resolvedStoreId)
        .eq('page_type', pageType)
        .eq('status', 'draft')
        .order('version_number', { ascending: false })
        .limit(1)
        .maybeSingle();

      // If no draft found, try published
      if (!slotConfig && !fetchError) {
        const { data: publishedConfig, error: pubError } = await tenantDb
          .from('slot_configurations')
          .select('*')
          .eq('store_id', resolvedStoreId)
          .eq('page_type', pageType)
          .eq('status', 'published')
          .order('version_number', { ascending: false })
          .limit(1)
          .maybeSingle();

        slotConfig = publishedConfig;
        fetchError = pubError;
        console.log('[AI Chat] No draft found, using published config for layout modify');
      }

      if (fetchError) {
        console.error('[AI Chat] Failed to fetch slot configuration:', fetchError);
        return res.status(500).json({
          success: false,
          message: 'Failed to fetch current layout configuration'
        });
      }

      if (!slotConfig) {
        return res.json({
          success: true,
          message: `I couldn't find a layout configuration for the ${pageType} page. Please save a layout in the Editor first, then I can help you modify it.`,
          data: { type: 'layout_error', reason: 'no_config_found' },
          creditsDeducted: creditsUsed
        });
      }

      // Parse the configuration
      const configuration = slotConfig.configuration || {};
      let slots = configuration.slots || {};
      const slotOrder = configuration.slotOrder || Object.keys(slots);

      console.log('[AI Chat] Config structure:', {
        hasConfiguration: !!slotConfig.configuration,
        hasSlots: !!configuration.slots,
        slotCount: Object.keys(slots).length,
        topLevelKeys: Object.keys(configuration).slice(0, 10)
      });
      console.log('[AI Chat] Available slots:', Object.keys(slots));
      console.log('[AI Chat] Current slot order:', slotOrder);

      // Check if slots object is empty - try to auto-recover by loading default slots
      if (Object.keys(slots).length === 0) {
        console.log('[AI Chat] Empty slots object in database configuration, attempting auto-recovery...');
        console.log('[AI Chat] Full configuration (first 500 chars):', JSON.stringify(slotConfig.configuration).substring(0, 500));

        // Try to load default slots from the config file
        try {
          const path = require('path');
          const configsDir = path.resolve(__dirname, '../../../src/components/editor/slot/configs');
          let configPath, configExport;

          switch (pageType) {
            case 'product':
              configPath = path.join(configsDir, 'product-config.js');
              configExport = 'productConfig';
              break;
            case 'category':
              configPath = path.join(configsDir, 'category-config.js');
              configExport = 'categoryConfig';
              break;
            case 'cart':
              configPath = path.join(configsDir, 'cart-config.js');
              configExport = 'cartConfig';
              break;
            case 'checkout':
              configPath = path.join(configsDir, 'checkout-config.js');
              configExport = 'checkoutConfig';
              break;
            case 'success':
              configPath = path.join(configsDir, 'success-config.js');
              configExport = 'successConfig';
              break;
            case 'header':
              configPath = path.join(configsDir, 'header-config.js');
              configExport = 'headerConfig';
              break;
            default:
              configPath = path.join(configsDir, `${pageType}-config.js`);
              configExport = `${pageType}Config`;
          }

          const configModule = await import(configPath);
          const defaultConfig = configModule[configExport];

          if (defaultConfig && defaultConfig.slots && Object.keys(defaultConfig.slots).length > 0) {
            // Found default slots - use them and update the database
            console.log(`[AI Chat] Loaded ${Object.keys(defaultConfig.slots).length} default slots from ${pageType}-config.js`);
            slots = defaultConfig.slots;

            // Update the database configuration with the default slots
            const updatedConfig = {
              ...configuration,
              slots: slots,
              metadata: {
                ...configuration.metadata,
                autoRecoveredSlots: true,
                recoveredAt: new Date().toISOString()
              }
            };

            const { error: updateError } = await tenantDb
              .from('slot_configurations')
              .update({
                configuration: updatedConfig,
                updated_at: new Date().toISOString()
              })
              .eq('id', slotConfig.id);

            if (updateError) {
              console.error('[AI Chat] Failed to update config with recovered slots:', updateError);
            } else {
              console.log('[AI Chat] Successfully updated database with recovered slots');
            }
          } else {
            throw new Error('Default config has no slots');
          }
        } catch (loadError) {
          console.error('[AI Chat] Failed to load default slots:', loadError);
          return res.json({
            success: true,
            message: `The ${pageType} page layout exists but has no slot configuration saved. Please open the ${pageType} page in the Editor, make a change (even a small one), and save it. Then I can help you modify the layout.`,
            data: {
              type: 'layout_error',
              reason: 'empty_slots',
              configId: slotConfig.id,
              pageType: pageType,
              configStatus: slotConfig.status,
              hint: 'The slot configuration may need to be re-saved from the Editor to populate the slots object.'
            },
            creditsDeducted: creditsUsed
          });
        }
      }

      // Build hierarchical slot info for better AI understanding
      const slotsByParent = {};
      Object.entries(slots).forEach(([id, slot]) => {
        const parentId = slot.parentId || 'root';
        if (!slotsByParent[parentId]) {
          slotsByParent[parentId] = [];
        }
        slotsByParent[parentId].push({
          id,
          type: slot.type,
          row: slot.position?.row,
          name: slot.name || slot.metadata?.displayName || id
        });
      });

      // Sort each parent's children by row
      Object.keys(slotsByParent).forEach(parentId => {
        slotsByParent[parentId].sort((a, b) => (a.row ?? 999) - (b.row ?? 999));
      });

      // Format hierarchical structure for prompt
      const hierarchyText = Object.entries(slotsByParent).map(([parentId, children]) => {
        const childList = children.map((c, idx) => `    ${idx + 1}. ${c.id} (row ${c.row}): ${c.name}`).join('\n');
        return `Container: ${parentId}\n${childList}`;
      }).join('\n\n');

      // Build a slot name lookup map for resolving user-friendly names to actual slot IDs
      const slotNameMap = {};
      Object.entries(slots).forEach(([id, slot]) => {
        // Add the ID itself
        slotNameMap[id.toLowerCase()] = id;
        // Add without underscores
        slotNameMap[id.toLowerCase().replace(/_/g, ' ')] = id;
        // Add display name if available
        if (slot.metadata?.displayName) {
          slotNameMap[slot.metadata.displayName.toLowerCase()] = id;
        }
        // Add name if available
        if (slot.name) {
          slotNameMap[slot.name.toLowerCase()] = id;
        }
      });

      // Add common aliases
      const commonAliases = {
        'sku': 'product_sku',
        'price': 'price_container',
        'the price': 'price_container',
        'product price': 'product_price',
        'main price': 'product_price',
        'title': 'product_title',
        'product title': 'product_title',
        'name': 'product_title',
        'product name': 'product_title',
        'description': 'product_short_description',
        'short description': 'product_short_description',
        'stock': 'stock_status',
        'stock status': 'stock_status',
        'availability': 'stock_status',
        'gallery': 'product_gallery_container',
        'images': 'product_gallery_container',
        'product images': 'product_gallery_container',
        'add to cart': 'add_to_cart_button',
        'cart button': 'add_to_cart_button',
        'buy button': 'add_to_cart_button',
        'wishlist': 'wishlist_button',
        'quantity': 'quantity_selector',
        'qty': 'quantity_selector',
        'tabs': 'product_tabs',
        'product tabs': 'product_tabs',
        'breadcrumbs': 'breadcrumbs',
        'related products': 'related_products_container',
        'related': 'related_products_container',
        'options': 'options_container',
        'custom options': 'custom_options'
      };
      // Always add common aliases - we'll validate the resolved ID later
      Object.entries(commonAliases).forEach(([alias, slotId]) => {
        slotNameMap[alias] = slotId;
      });

      console.log('[AI Chat] Slot name map keys:', Object.keys(slotNameMap).slice(0, 20));
      console.log('[AI Chat] Available slots:', Object.keys(slots));

      /**
       * Resolve a user-provided slot name to actual slot ID
       */
      const resolveSlotId = (name) => {
        if (!name) return null;
        const lower = name.toLowerCase().trim();

        // Direct match
        if (slots[lower]) return lower;
        if (slots[name]) return name;

        // Lookup in map
        if (slotNameMap[lower]) return slotNameMap[lower];

        // Fuzzy match - check if any key contains the name or vice versa
        for (const [key, slotId] of Object.entries(slotNameMap)) {
          if (key.includes(lower) || lower.includes(key)) {
            return slotId;
          }
        }

        return null;
      };

      /**
       * Get suggestions for a slot name that wasn't found
       * Uses Levenshtein distance and keyword matching
       */
      const getSuggestions = (name, maxSuggestions = 3) => {
        if (!name) return [];
        const lower = name.toLowerCase().trim();
        const suggestions = [];

        // Simple Levenshtein distance
        const levenshtein = (a, b) => {
          if (a.length === 0) return b.length;
          if (b.length === 0) return a.length;
          const matrix = [];
          for (let i = 0; i <= b.length; i++) matrix[i] = [i];
          for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
          for (let i = 1; i <= b.length; i++) {
            for (let j = 1; j <= a.length; j++) {
              matrix[i][j] = b.charAt(i - 1) === a.charAt(j - 1)
                ? matrix[i - 1][j - 1]
                : Math.min(matrix[i - 1][j - 1] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j] + 1);
            }
          }
          return matrix[b.length][a.length];
        };

        // Score all slot names
        const scored = [];
        const seen = new Set();

        // Check aliases and slot IDs
        for (const [key, slotId] of Object.entries(slotNameMap)) {
          if (seen.has(slotId)) continue;
          seen.add(slotId);

          const distance = levenshtein(lower, key);
          const containsMatch = key.includes(lower) || lower.includes(key);
          const startsWithMatch = key.startsWith(lower) || lower.startsWith(key);

          // Score: lower is better
          let score = distance;
          if (containsMatch) score -= 3;
          if (startsWithMatch) score -= 5;

          // Get friendly name for display
          const slot = slots[slotId];
          const friendlyName = slot?.metadata?.displayName ||
                              slot?.name ||
                              slotId.replace(/_/g, ' ');

          scored.push({ slotId, friendlyName, key, score, distance });
        }

        // Sort by score and return top suggestions
        scored.sort((a, b) => a.score - b.score);
        return scored.slice(0, maxSuggestions).map(s => ({
          slotId: s.slotId,
          name: s.friendlyName,
          hint: s.key !== s.slotId ? `(you can say "${s.key}")` : ''
        }));
      };

      // Use AI to analyze - AI just needs to understand INTENT, we resolve the IDs
      const layoutAnalysisPrompt = `Understand this layout modification request.

AVAILABLE ELEMENTS ON PAGE:
${hierarchyText}

USER REQUEST: "${message}"

Your job: Understand what the user wants to move and where.

Return JSON:
{
  "understood": true/false,
  "source": "what user wants to move (use their words)",
  "target": "where to move it relative to (use their words)",
  "action": "move|swap|remove",
  "position": "before|after",
  "description": "human-readable description",
  "error": "error if request is unclear"
}

Examples:
- "move sku above price" → {source: "sku", target: "price", position: "before"}
- "put the title after description" → {source: "title", target: "description", position: "after"}
- "swap gallery and tabs" → {source: "gallery", target: "tabs", action: "swap"}

Return ONLY valid JSON.`;

      const analysisResult = await aiService.generate({
        userId,
        operationType: 'general',
        modelId,
        serviceKey,
        prompt: layoutAnalysisPrompt,
        systemPrompt: 'You are a layout configuration expert. Analyze slot configurations and determine how to reorder them. Return ONLY valid JSON.',
        maxTokens: 512,
        temperature: 0.2,
        metadata: { type: 'layout-analysis', storeId: resolvedStoreId, modelId }
      });
      creditsUsed += analysisResult.creditsDeducted;

      let analysis;
      try {
        const jsonMatch = analysisResult.content.match(/\{[\s\S]*\}/);
        analysis = JSON.parse(jsonMatch ? jsonMatch[0] : analysisResult.content);
      } catch (e) {
        console.error('Failed to parse layout analysis:', e);
        return res.json({
          success: true,
          message: "I couldn't understand how to modify the layout. Could you be more specific? For example: 'move the SKU above the stock label' or 'swap the price and title positions'.",
          data: { type: 'layout_error', reason: 'parse_error' },
          creditsDeducted: creditsUsed
        });
      }

      console.log('[AI Chat] Layout analysis result:', JSON.stringify(analysis));

      if (!analysis.understood || analysis.error) {
        return res.json({
          success: true,
          message: analysis.error || "I couldn't understand that layout change. Try something like: 'move sku above price' or 'put title after description'",
          data: { type: 'layout_error', reason: 'not_understood', analysis },
          creditsDeducted: creditsUsed
        });
      }

      // Validate AI returned source and target (new format - we resolve IDs ourselves)
      if (!analysis.source) {
        return res.json({
          success: true,
          message: "I couldn't determine which element you want to move. Try: 'move [element] above/below [target]'",
          data: { type: 'layout_error', reason: 'no_source' },
          creditsDeducted: creditsUsed
        });
      }

      // SMART RESOLUTION: Map AI's response (source/target) to actual slot IDs
      const sourceSlotIdResolved = resolveSlotId(analysis.source);
      const targetSlotIdResolved = resolveSlotId(analysis.target);

      console.log('[AI Chat] AI understood:', { source: analysis.source, target: analysis.target, position: analysis.position });
      console.log('[AI Chat] Resolved to:', { sourceSlotId: sourceSlotIdResolved, targetSlotId: targetSlotIdResolved });

      // Helper to build helpful error message with available slots
      const getAvailableSlotsList = () => {
        return Object.keys(slots)
          .filter(id => id !== 'main_layout' && id !== 'content_area') // Skip containers
          .slice(0, 10)
          .map(id => {
            const slot = slots[id];
            const name = slot?.metadata?.displayName || id.replace(/_/g, ' ');
            return name;
          });
      };

      // Validate we could resolve the source
      if (!sourceSlotIdResolved) {
        console.error('[AI Chat] Could not resolve source:', analysis.source);
        const suggestions = getSuggestions(analysis.source);
        const availableSlots = getAvailableSlotsList();
        const suggestionText = suggestions.length > 0
          ? `\n\nDid you mean:\n${suggestions.map(s => `• ${s.name} ${s.hint}`).join('\n')}`
          : `\n\nAvailable elements: ${availableSlots.join(', ')}`;

        return res.json({
          success: true,
          message: `I couldn't find an element called "${analysis.source}" on this page.${suggestionText}`,
          data: {
            type: 'layout_error',
            reason: 'source_not_found',
            searched: analysis.source,
            suggestions: suggestions,
            availableSlots: availableSlots
          },
          creditsDeducted: creditsUsed
        });
      }

      // Check if resolved source slot actually exists in config
      if (!slots[sourceSlotIdResolved]) {
        console.error('[AI Chat] Resolved source slot not in config:', sourceSlotIdResolved);
        const availableSlots = getAvailableSlotsList();
        return res.json({
          success: true,
          message: `The "${analysis.source}" element doesn't exist in this page's saved layout.\n\nAvailable elements: ${availableSlots.join(', ')}`,
          data: {
            type: 'layout_error',
            reason: 'source_slot_not_in_config',
            resolvedTo: sourceSlotIdResolved,
            availableSlots: availableSlots
          },
          creditsDeducted: creditsUsed
        });
      }

      // Validate we could resolve the target (if action requires it)
      if (analysis.action !== 'remove' && !targetSlotIdResolved) {
        console.error('[AI Chat] Could not resolve target:', analysis.target);
        const suggestions = getSuggestions(analysis.target);
        const availableSlots = getAvailableSlotsList();
        const suggestionText = suggestions.length > 0
          ? `\n\nDid you mean:\n${suggestions.map(s => `• ${s.name} ${s.hint}`).join('\n')}`
          : `\n\nAvailable elements: ${availableSlots.join(', ')}`;

        return res.json({
          success: true,
          message: `I couldn't find an element called "${analysis.target}" on this page.${suggestionText}`,
          data: {
            type: 'layout_error',
            reason: 'target_not_found',
            searched: analysis.target,
            suggestions: suggestions,
            availableSlots: availableSlots
          },
          creditsDeducted: creditsUsed
        });
      }

      // Check if resolved target slot actually exists in config
      if (analysis.action !== 'remove' && !slots[targetSlotIdResolved]) {
        console.error('[AI Chat] Resolved target slot not in config:', targetSlotIdResolved);
        const availableSlots = getAvailableSlotsList();
        return res.json({
          success: true,
          message: `The "${analysis.target}" element doesn't exist in this page's saved layout.\n\nAvailable elements: ${availableSlots.join(', ')}`,
          data: {
            type: 'layout_error',
            reason: 'target_slot_not_in_config',
            resolvedTo: targetSlotIdResolved,
            availableSlots: availableSlots
          },
          creditsDeducted: creditsUsed
        });
      }

      // Store resolved IDs in analysis for later use
      analysis.sourceSlotId = sourceSlotIdResolved;
      analysis.targetSlotId = targetSlotIdResolved;

      // CRITICAL FIX: Update position.row values for hierarchical slot ordering
      // Slots are sorted by position.row, not by slotOrder array
      const sourceSlotId = analysis.sourceSlotId;
      const targetSlotId = analysis.targetSlotId;
      const sourceSlot = slots[sourceSlotId];
      const targetSlot = slots[targetSlotId];

      if (sourceSlot && targetSlot && sourceSlot.parentId === targetSlot.parentId) {
        // Both slots are in the same container - update position.row values
        const parentId = sourceSlot.parentId;
        console.log('[AI Chat] Reordering slots within parent:', parentId);

        // Get all sibling slots (same parent)
        const siblingSlots = Object.entries(slots)
          .filter(([id, slot]) => slot.parentId === parentId)
          .sort((a, b) => {
            const rowA = a[1].position?.row ?? 999;
            const rowB = b[1].position?.row ?? 999;
            return rowA - rowB;
          });

        console.log('[AI Chat] Current sibling order:', siblingSlots.map(([id]) => id));

        // Determine new order based on action
        const currentOrder = siblingSlots.map(([id]) => id);
        const sourceIndex = currentOrder.indexOf(sourceSlotId);
        const targetIndex = currentOrder.indexOf(targetSlotId);

        if (sourceIndex !== -1 && targetIndex !== -1) {
          // Remove source from current position
          currentOrder.splice(sourceIndex, 1);

          // Calculate new target index (adjusted if source was before target)
          let newTargetIndex = currentOrder.indexOf(targetSlotId);
          if (analysis.action === 'move' && analysis.position === 'after') {
            newTargetIndex += 1;
          }

          // Insert source at new position
          currentOrder.splice(newTargetIndex, 0, sourceSlotId);

          console.log('[AI Chat] New sibling order:', currentOrder);

          // Update position.row for all siblings based on new order
          currentOrder.forEach((slotId, index) => {
            if (slots[slotId] && slots[slotId].position) {
              const newRow = index + 1; // 1-indexed rows
              console.log(`[AI Chat] Updating ${slotId} row: ${slots[slotId].position.row} -> ${newRow}`);
              slots[slotId].position.row = newRow;
            }
          });
        }
      } else if (sourceSlot && targetSlot) {
        // Cross-container move - move source to target's container
        console.log('[AI Chat] Cross-container move:', sourceSlot.parentId, '->', targetSlot.parentId);

        const oldParentId = sourceSlot.parentId;
        const newParentId = targetSlot.parentId;

        // Update source slot's parent
        sourceSlot.parentId = newParentId;

        // Get siblings in new container and insert source at right position
        const newSiblings = Object.entries(slots)
          .filter(([id, slot]) => slot.parentId === newParentId && id !== sourceSlotId)
          .sort((a, b) => (a[1].position?.row ?? 999) - (b[1].position?.row ?? 999));

        const newOrder = newSiblings.map(([id]) => id);
        let targetIndex = newOrder.indexOf(targetSlotId);
        if (analysis.action === 'move' && analysis.position === 'after') {
          targetIndex += 1;
        }
        newOrder.splice(targetIndex, 0, sourceSlotId);

        console.log('[AI Chat] New container order:', newOrder);

        // Update row positions in new container
        newOrder.forEach((slotId, index) => {
          if (slots[slotId]?.position) {
            slots[slotId].position.row = index + 1;
          }
        });

        // Reorder remaining slots in old container
        const oldSiblings = Object.entries(slots)
          .filter(([id, slot]) => slot.parentId === oldParentId)
          .sort((a, b) => (a[1].position?.row ?? 999) - (b[1].position?.row ?? 999));

        oldSiblings.forEach(([slotId], index) => {
          if (slots[slotId]?.position) {
            slots[slotId].position.row = index + 1;
          }
        });

        console.log('[AI Chat] Cross-container move completed');
      }

      // Build the updated configuration with updated slot positions
      const updatedConfiguration = {
        ...configuration,
        slots: slots, // Updated slots with new position.row values
        // Keep existing slotOrder - position.row is what matters for rendering
        metadata: {
          ...configuration.metadata,
          lastModified: new Date().toISOString(),
          lastModifiedBy: 'AI Assistant',
          lastLayoutChange: analysis.description
        }
      };

      // Update the slot configuration
      console.log('[AI Chat] Updating layout for config id:', slotConfig.id);
      console.log('[AI Chat] Change:', analysis.description);

      const { data: updatedData, error: updateError } = await tenantDb
        .from('slot_configurations')
        .update({
          configuration: updatedConfiguration,
          updated_at: new Date().toISOString(),
          metadata: {
            ...slotConfig.metadata,
            ai_generated: true,
            last_ai_change: analysis.description,
            last_ai_request: message
          }
        })
        .eq('id', slotConfig.id)
        .select('id, configuration')
        .single();

      if (updateError) {
        console.error('[AI Chat] Failed to save layout change:', updateError);
        return res.status(500).json({
          success: false,
          message: 'Failed to save layout change: ' + updateError.message
        });
      }

      if (!updatedData) {
        console.error('[AI Chat] Update returned no data - row may not exist');
        return res.status(500).json({
          success: false,
          message: 'Failed to update layout - configuration not found'
        });
      }

      console.log('[AI Chat] Successfully updated layout order:', updatedData.id);

      // Let AI generate varied response
      const responsePrompt = `Changes made: ${analysis.description}

Confirm in 1 sentence. MUST mention the specific change. Keep it casual. No "Great/I've/Let me know".`;

      const responseResult = await aiService.generate({
        userId,
        operationType: 'general',
        modelId,
        serviceKey,
        prompt: responsePrompt,
        systemPrompt: 'Mention the SPECIFIC change made. One casual sentence.',
        maxTokens: 40,
        temperature: 0.8,
        metadata: { type: 'response', storeId: resolvedStoreId, modelId }
      });
      creditsUsed += responseResult.creditsDeducted;

      responseData = {
        type: 'layout_modified',
        pageType,
        action: analysis.action,
        sourceSlotId: analysis.sourceSlotId,
        targetSlotId: analysis.targetSlotId,
        position: analysis.position,
        description: analysis.description,
        configId: slotConfig.id
      };

      // Save layout response for learning
      aiContextService.saveChatMessage({
        userId,
        storeId: resolvedStoreId,
        sessionId,
        role: 'assistant',
        content: responseResult.content,
        intent: 'layout_modify',
        operation: analysis.action,
        wasSuccessful: true,
        metadata: {
          sourceElement: analysis.source,
          targetElement: analysis.target,
          position: analysis.position,
          pageType
        }
      }).catch(err => console.error('Failed to save layout response:', err));

      res.json({
        success: true,
        message: responseResult.content,
        data: responseData,
        creditsDeducted: creditsUsed
      });
      return;

    } else if (intent.intent === 'admin_entity') {
      // Handle admin entity operations (product tabs, settings, coupons, etc.)
      console.log('[AI Chat] Entering admin_entity handler');
      console.log('[AI Chat] Admin entity details:', JSON.stringify(intent.details));

      if (!resolvedStoreId) {
        return res.status(400).json({
          success: false,
          message: 'store_id is required for admin entity operations'
        });
      }

      try {
        const entityName = intent.details?.entity;
        const operation = intent.details?.operation || 'update';
        const searchTerm = intent.details?.search_term;
        const params = intent.details?.params || {};

        if (!entityName) {
          // If no entity detected, use dynamic detection from database
          console.log('[AI Chat] No entity in intent, using dynamic detection');
          const dynamicIntent = await aiEntityService.detectEntityIntent(
            resolvedStoreId,
            message,
            aiService,
            userId
          );
          creditsUsed += dynamicIntent.creditsUsed || 0;

          if (dynamicIntent.intent !== 'admin_entity' || !dynamicIntent.entity) {
            return res.json({
              success: true,
              message: "I couldn't determine which admin setting you want to change. Could you be more specific? For example: 'rename the specs tab to Technical Details' or 'create a 20% discount coupon'.",
              data: { type: 'admin_error', reason: 'entity_not_detected' },
              creditsDeducted: creditsUsed
            });
          }

          // Use the dynamically detected values
          intent.details = {
            entity: dynamicIntent.entity,
            operation: dynamicIntent.operation,
            search_term: dynamicIntent.search_term,
            params: dynamicIntent.params
          };
        }

        const detectedEntity = intent.details.entity;
        const detectedOperation = intent.details.operation || 'update';
        const detectedSearchTerm = intent.details.search_term;
        const detectedParams = intent.details.params || {};

        // Get entity definition
        const entityDef = await aiEntityService.getEntityDefinition(resolvedStoreId, detectedEntity);

        if (!entityDef) {
          return res.json({
            success: true,
            message: `I don't recognize the entity "${detectedEntity}". I can help with: product tabs, categories, attributes, coupons, payment methods, shipping, languages, SEO settings, store settings, tax settings, CMS pages, and email templates.`,
            data: { type: 'admin_error', reason: 'unknown_entity' },
            creditsDeducted: creditsUsed
          });
        }

        // If we need to find an entity by search term, do that first
        let targetId = detectedParams.id;
        if (!targetId && detectedSearchTerm && ['update', 'delete', 'get'].includes(detectedOperation)) {
          console.log(`[AI Chat] Searching for ${detectedEntity} matching: ${detectedSearchTerm}`);
          const found = await aiEntityService.findEntityBySearchTerm(resolvedStoreId, detectedEntity, detectedSearchTerm);

          if (!found) {
            return res.json({
              success: true,
              message: `I couldn't find a ${entityDef.display_name} matching "${detectedSearchTerm}". Would you like me to list all available ${entityDef.display_name}?`,
              data: { type: 'admin_error', reason: 'not_found', search_term: detectedSearchTerm },
              creditsDeducted: creditsUsed
            });
          }

          if (Array.isArray(found)) {
            // Multiple matches - ask user to clarify
            const options = found.map(f => f.name || f.code || f.title || f[entityDef.primary_key]).join(', ');
            return res.json({
              success: true,
              message: `I found multiple ${entityDef.display_name} matching "${detectedSearchTerm}": ${options}. Which one did you mean?`,
              data: { type: 'admin_clarification', matches: found, entity: detectedEntity },
              creditsDeducted: creditsUsed
            });
          }

          targetId = found[entityDef.primary_key || 'id'];
          console.log(`[AI Chat] Found entity with ID: ${targetId}`);
        }

        // Execute the operation
        const operationParams = { ...detectedParams };
        if (targetId) {
          operationParams.id = targetId;
        }

        console.log(`[AI Chat] Executing ${detectedOperation} on ${detectedEntity}:`, operationParams);

        const result = await aiEntityService.executeEntityOperation(
          resolvedStoreId,
          detectedEntity,
          detectedOperation,
          operationParams,
          { search_term: detectedSearchTerm }
        );

        // Generate natural response
        const responseGen = await aiEntityService.generateEntityResponse(
          resolvedStoreId,
          entityDef,
          detectedOperation,
          result,
          aiService,
          userId,
          message
        );
        creditsUsed += responseGen.creditsUsed || 0;

        responseData = {
          type: 'admin_entity_modified',
          entity: detectedEntity,
          operation: detectedOperation,
          result: result.data,
          entityDef: {
            display_name: entityDef.display_name,
            category: entityDef.category
          }
        };

        res.json({
          success: true,
          message: responseGen.message,
          data: responseData,
          creditsDeducted: creditsUsed
        });
        return;

      } catch (error) {
        console.error('[AI Chat] Admin entity error:', error);
        return res.json({
          success: true,
          message: `I encountered an error while trying to update: ${error.message}. Please try again or contact support if the problem persists.`,
          data: { type: 'admin_error', reason: 'operation_failed', error: error.message },
          creditsDeducted: creditsUsed
        });
      }

    } else if (intent.intent === 'styling') {
      // Handle styling changes to slot configurations
      console.log('[AI Chat] Entering styling handler');
      console.log('[AI Chat] Styling details:', JSON.stringify(intent.details));
      const ConnectionManager = require('../services/database/ConnectionManager');

      // Use global AI conversations array
      const aiConversations = globalAiConversations;

      if (!resolvedStoreId) {
        return res.status(400).json({
          success: false,
          message: 'store_id is required for styling changes'
        });
      }

      const tenantDb = await ConnectionManager.getStoreConnection(resolvedStoreId);
      const pageType = intent.details?.pageType || 'product';

      // Normalize changes to array format (supports single or multiple changes)
      let stylingChanges = [];
      if (intent.details?.changes && Array.isArray(intent.details.changes)) {
        stylingChanges = intent.details.changes;
      } else if (intent.details?.element && intent.details?.property) {
        // Single change format
        stylingChanges = [{
          element: intent.details.element,
          property: intent.details.property,
          value: intent.details.value
        }];
      }

      console.log('[AI Chat] Styling changes to apply:', JSON.stringify(stylingChanges));

      if (stylingChanges.length === 0) {
        return res.json({
          success: true,
          message: "I couldn't determine what styling changes you want to make. Could you be more specific? For example: 'change the product title color to red' or 'increase the price font size to 24px'",
          data: { type: 'styling_error', reason: 'no_changes_specified' },
          creditsDeducted: creditsUsed
        });
      }

      // Fetch current slot configuration for the page type (draft first, then published)
      // Draft is used for preview, published is for live site
      let { data: slotConfig, error: fetchError } = await tenantDb
        .from('slot_configurations')
        .select('*')
        .eq('store_id', resolvedStoreId)
        .eq('page_type', pageType)
        .eq('status', 'draft')
        .order('version_number', { ascending: false })
        .limit(1)
        .maybeSingle();

      // If no draft found, try published
      if (!slotConfig && !fetchError) {
        const { data: publishedConfig, error: pubError } = await tenantDb
          .from('slot_configurations')
          .select('*')
          .eq('store_id', resolvedStoreId)
          .eq('page_type', pageType)
          .eq('status', 'published')
          .order('version_number', { ascending: false })
          .limit(1)
          .maybeSingle();

        slotConfig = publishedConfig;
        fetchError = pubError;
        console.log('[AI Chat] No draft found, using published config');
      }

      if (fetchError) {
        console.error('[AI Chat] Failed to fetch slot configuration:', fetchError);
        return res.status(500).json({
          success: false,
          message: 'Failed to fetch current layout configuration'
        });
      }

      console.log('[AI Chat] Fetched slot config:', slotConfig ? `id=${slotConfig.id}, page=${slotConfig.page_type}` : 'null');

      if (!slotConfig) {
        return res.json({
          success: true,
          message: `I couldn't find a layout configuration for the ${pageType} page. Please save a layout in the Editor first, then I can help you modify styles.`,
          data: { type: 'styling_error', reason: 'no_config_found' },
          creditsDeducted: creditsUsed
        });
      }

      // Parse the configuration
      const configuration = slotConfig.configuration || {};
      let updatedSlots = { ...configuration.slots || {} };
      const slots = configuration.slots || {};

      console.log('[AI Chat] Available slots:', Object.keys(slots));
      console.log('[AI Chat] Processing', stylingChanges.length, 'change(s)');

      // Helper function to find slot by element name
      const findSlot = async (elementName) => {
        // Try exact match first
        if (elementName && slots[elementName]) {
          return { slot: slots[elementName], slotId: elementName };
        }

        // Try common variations
        const variations = [
          elementName,
          elementName?.replace(/_/g, '-'),
          elementName?.replace(/-/g, '_'),
          `${pageType}_${elementName}`,
          `${pageType}-${elementName}`,
        ].filter(Boolean);

        for (const variant of variations) {
          if (slots[variant]) {
            return { slot: slots[variant], slotId: variant };
          }
        }

        // Use AI to find matching slot
        const slotNames = Object.keys(slots).map(id => ({
          id,
          name: slots[id].name || id,
          type: slots[id].type || 'unknown'
        }));

        const matchPrompt = `Given these slots: ${JSON.stringify(slotNames)}
The user wants to modify "${elementName}".
Return JSON: { "slotId": "the_slot_id" }`;

        try {
          const matchResult = await aiService.generate({
            userId,
            operationType: 'general',
            modelId,
            serviceKey,
            prompt: matchPrompt,
            systemPrompt: 'Match element names to slot IDs. Return ONLY valid JSON.',
            maxTokens: 100,
            temperature: 0.2,
            metadata: { type: 'slot-matching', storeId: resolvedStoreId, modelId }
          });
          creditsUsed += matchResult.creditsDeducted;

          const match = JSON.parse(matchResult.content.match(/\{[\s\S]*\}/)?.[0] || '{}');
          if (match.slotId && slots[match.slotId]) {
            return { slot: slots[match.slotId], slotId: match.slotId };
          }
        } catch (e) {
          console.warn('Slot matching failed:', e.message);
        }

        return { slot: null, slotId: null };
      };

      // Process all changes
      const appliedChanges = [];
      const failedChanges = [];

      for (const change of stylingChanges) {
        const { element, property, value } = change;
        console.log('[AI Chat] Processing change:', JSON.stringify(change));

        const { slot: targetSlot, slotId: targetSlotId } = await findSlot(element);

        if (!targetSlot || !targetSlotId) {
          failedChanges.push({ element, reason: 'slot not found' });
          continue;
        }

        // Get current slot state (may have been modified by previous change)
        const currentSlot = updatedSlots[targetSlotId] || targetSlot;
        const currentClassName = currentSlot.className || '';
        const currentStyles = currentSlot.styles || {};
        let newClassName = currentClassName;
        let newStyles = { ...currentStyles };
        let changeDescription = '';

        // Load colord for color parsing
        const { colord, extend } = require('colord');
        const namesPlugin = require('colord/plugins/names');
        extend([namesPlugin]);

      // Smart color parser - uses AI for natural language descriptions
      const parseColor = async (colorValue) => {
        if (!colorValue) return null;

        // First try colord for standard formats (hex, rgb, hsl, CSS names)
        const cleaned = colorValue.toLowerCase().trim().replace(/\s+/g, '');
        const parsed = colord(cleaned);
        if (parsed.isValid()) {
          return parsed.toHex();
        }

        // If not a standard format, use AI to interpret the color description
        const colorPrompt = `Convert this color description to a hex color code:
"${colorValue}"

Return ONLY a JSON object: { "hex": "#xxxxxx", "name": "color name" }

Examples:
- "light green" → { "hex": "#90ee90", "name": "light green" }
- "dark ocean blue" → { "hex": "#1a3a5c", "name": "dark ocean blue" }
- "warm sunset orange" → { "hex": "#ff6b35", "name": "warm sunset orange" }
- "muted purple" → { "hex": "#9370db", "name": "muted purple" }

Return ONLY valid JSON.`;

        try {
          const colorSystemPrompt = 'You are a color expert. Convert color descriptions to precise hex codes. Return ONLY valid JSON.';
          const colorResult = await aiService.generate({
            userId,
            operationType: 'general',
            modelId,
            serviceKey,
            prompt: colorPrompt,
            systemPrompt: colorSystemPrompt,
            maxTokens: 100,
            temperature: 0.3,
            metadata: { type: 'color-parsing', storeId: resolvedStoreId, modelId }
          });
          creditsUsed += colorResult.creditsDeducted;

          // Track this AI conversation
          aiConversations.push({
            step: 'color-parsing',
            provider: 'anthropic',
            model: colorResult.usage?.model || 'claude-3-haiku',
            prompt: colorPrompt,
            systemPrompt: colorSystemPrompt,
            response: colorResult.content,
            tokens: colorResult.usage
          });

          const colorJson = JSON.parse(colorResult.content.match(/\{[\s\S]*\}/)?.[0] || '{}');
          if (colorJson.hex && /^#[0-9a-fA-F]{6}$/.test(colorJson.hex)) {
            return colorJson.hex;
          }
        } catch (e) {
          console.warn('AI color parsing failed:', e.message);
        }

        // Fallback to original value
        return colorValue;
      };

        if (property === 'color' || property === 'textColor') {
        // Remove existing Tailwind text color classes
        newClassName = currentClassName
          .replace(/text-(gray|red|blue|green|yellow|purple|pink|orange|black|white|slate|zinc|neutral|stone|amber|lime|emerald|teal|cyan|sky|indigo|violet|fuchsia|rose)-\d{2,3}/g, '')
          .replace(/text-(black|white|transparent|current|inherit)/g, '')
          .replace(/\s+/g, ' ')
          .trim();

        // Parse and apply the color as inline style (AI-powered for natural language)
        const hexColor = await parseColor(value);
        newStyles.color = hexColor;
        changeDescription = `Changed text color to ${value} (${hexColor})`;

      } else if (property === 'backgroundColor' || property === 'background') {
        // Remove existing Tailwind background color classes
        newClassName = currentClassName
          .replace(/bg-(gray|red|blue|green|yellow|purple|pink|orange|black|white|slate|zinc|neutral|stone|amber|lime|emerald|teal|cyan|sky|indigo|violet|fuchsia|rose)-\d{2,3}/g, '')
          .replace(/bg-(black|white|transparent|current|inherit)/g, '')
          .replace(/\s+/g, ' ')
          .trim();

        const hexColor = await parseColor(value);
        newStyles.backgroundColor = hexColor;
        changeDescription = `Changed background color to ${value} (${hexColor})`;

      } else if (property === 'fontSize' || property === 'size' || property === 'font-size' || property === 'textSize') {
        // Use AI to interpret font size value
        const currentSize = currentStyles.fontSize || '16px';
        const sizePrompt = `Convert this font size description to a valid CSS font-size value:
"${value}"

Current font size: ${currentSize}
Context: This is for a ${element || 'text element'} on a ${pageType} page.

If the request is relative (larger, bigger, smaller, etc.), calculate based on current size.
Return ONLY a JSON object: { "size": "24px", "interpretation": "description of change" }

Examples:
- "larger" with current 16px → { "size": "20px", "interpretation": "increased by 25%" }
- "much bigger" with current 14px → { "size": "21px", "interpretation": "increased by 50%" }
- "small" → { "size": "12px", "interpretation": "small text size" }
- "32" → { "size": "32px", "interpretation": "explicit pixel value" }
- "2rem" → { "size": "2rem", "interpretation": "explicit rem value" }

Return ONLY valid JSON.`;

        let finalSize = value;
        try {
          const sizeResult = await aiService.generate({
            userId,
            operationType: 'general',
            modelId,
            serviceKey,
            prompt: sizePrompt,
            systemPrompt: 'You are a CSS expert. Convert size descriptions to valid CSS values. Return ONLY valid JSON.',
            maxTokens: 100,
            temperature: 0.2,
            metadata: { type: 'size-parsing', storeId: resolvedStoreId, modelId }
          });
          creditsUsed += sizeResult.creditsDeducted;

          aiConversations.push({
            step: 'size-parsing',
            provider: 'anthropic',
            model: sizeResult.usage?.model || 'claude-3-haiku',
            prompt: sizePrompt,
            response: sizeResult.content,
            tokens: sizeResult.usage
          });

          const sizeJson = JSON.parse(sizeResult.content.match(/\{[\s\S]*\}/)?.[0] || '{}');
          if (sizeJson.size) {
            finalSize = sizeJson.size;
          }
        } catch (e) {
          console.warn('AI size parsing failed:', e.message);
          // Fallback: add px if just a number
          const num = parseFloat(value);
          if (!isNaN(num)) {
            finalSize = `${num}px`;
          }
        }

        newStyles.fontSize = finalSize;
        changeDescription = `Changed font size to ${finalSize}`;
      } else {
        // Use AI to interpret any CSS property value
        const cssPrompt = `Convert this styling request to a valid CSS property and value:
Property: "${property}"
Value: "${value}"
Element: ${element || 'text element'}
Page: ${pageType} page
Current styles: ${JSON.stringify(currentStyles)}

Return ONLY a JSON object: { "property": "css-property-name", "value": "valid-css-value", "interpretation": "what this does" }

Examples:
- property: "padding", value: "more" → { "property": "padding", "value": "16px", "interpretation": "increased padding" }
- property: "margin", value: "larger" → { "property": "margin", "value": "24px", "interpretation": "increased margin" }
- property: "border", value: "thin red" → { "property": "border", "value": "1px solid red", "interpretation": "thin red border" }
- property: "fontWeight", value: "bold" → { "property": "fontWeight", "value": "700", "interpretation": "bold text" }

Return ONLY valid JSON.`;

        let finalProperty = property;
        let finalValue = value;

        try {
          const cssResult = await aiService.generate({
            userId,
            operationType: 'general',
            modelId,
            serviceKey,
            prompt: cssPrompt,
            systemPrompt: 'You are a CSS expert. Convert style descriptions to valid CSS. Return ONLY valid JSON.',
            maxTokens: 150,
            temperature: 0.2,
            metadata: { type: 'css-parsing', storeId: resolvedStoreId, modelId }
          });
          creditsUsed += cssResult.creditsDeducted;

          aiConversations.push({
            step: 'css-parsing',
            provider: cssResult.provider || 'anthropic',
            model: cssResult.usage?.model || modelId || 'claude-3-haiku',
            prompt: cssPrompt,
            response: cssResult.content,
            tokens: cssResult.usage
          });

          const cssJson = JSON.parse(cssResult.content.match(/\{[\s\S]*\}/)?.[0] || '{}');
          if (cssJson.property && cssJson.value) {
            finalProperty = cssJson.property;
            finalValue = cssJson.value;
          }
        } catch (e) {
          console.warn('AI CSS parsing failed:', e.message);
        }

        newStyles[finalProperty] = finalValue;
        changeDescription = `Changed ${finalProperty} to ${finalValue}`;
      }

        // Update this slot in the accumulated changes
        updatedSlots[targetSlotId] = {
          ...currentSlot,
          className: newClassName,
          styles: newStyles
        };

        appliedChanges.push({
          element,
          slotId: targetSlotId,
          property,
          value,
          description: changeDescription
        });

        console.log('[AI Chat] Applied change:', changeDescription);
      } // End of for loop

      // Check if any changes were applied
      if (appliedChanges.length === 0) {
        return res.json({
          success: true,
          message: `I couldn't apply any of the requested changes. ${failedChanges.length > 0 ? `Failed to find: ${failedChanges.map(f => f.element).join(', ')}` : ''}`,
          data: { type: 'styling_error', reason: 'no_changes_applied', failedChanges },
          creditsDeducted: creditsUsed
        });
      }

      // Build the updated configuration with all changes
      const updatedConfiguration = {
        ...configuration,
        slots: updatedSlots,
        metadata: {
          ...configuration.metadata,
          lastModified: new Date().toISOString(),
          lastModifiedBy: 'AI Assistant'
        }
      };

      // Directly update the published configuration (no draft, immediate apply)
      const allChangeDescriptions = appliedChanges.map(c => c.description).join('; ');
      console.log('[AI Chat] Updating slot config id:', slotConfig.id);
      console.log('[AI Chat] Applied', appliedChanges.length, 'change(s):', allChangeDescriptions);

      const { data: updatedData, error: updateError } = await tenantDb
        .from('slot_configurations')
        .update({
          configuration: updatedConfiguration,
          updated_at: new Date().toISOString(),
          metadata: {
            ...slotConfig.metadata,
            ai_generated: true,
            last_ai_change: allChangeDescriptions,
            last_ai_request: message
          }
        })
        .eq('id', slotConfig.id)
        .select('id, configuration')
        .single();

      if (updateError) {
        console.error('[AI Chat] Failed to save styling change:', updateError);
        return res.status(500).json({
          success: false,
          message: 'Failed to save styling change: ' + updateError.message
        });
      }

      if (!updatedData) {
        console.error('[AI Chat] Update returned no data - row may not exist');
        return res.status(500).json({
          success: false,
          message: 'Failed to update styling - configuration not found'
        });
      }

      console.log('[AI Chat] Successfully updated slot config:', updatedData.id);
      console.log('[AI Chat] Changes applied:', allChangeDescriptions);

      // Let AI generate varied response
      const changesSummary = appliedChanges.map(c => c.description).join('; ');

      const responsePrompt = `Changes made: ${changesSummary}

Confirm in 1 sentence. MUST mention the specific changes. Keep it casual. No "Great/I've/Let me know".`;

      const responseResult = await aiService.generate({
        userId,
        operationType: 'general',
        modelId,
        serviceKey,
        prompt: responsePrompt,
        systemPrompt: 'Mention the SPECIFIC changes made. One casual sentence.',
        maxTokens: 40,
        temperature: 0.8,
        metadata: { type: 'response', storeId: resolvedStoreId, modelId }
      });
      creditsUsed += responseResult.creditsDeducted;

      responseData = {
        type: 'styling_applied',
        pageType,
        appliedChanges,
        failedChanges,
        configId: slotConfig.id,
        aiConversations,
        detectedIntent: intent
      };

      // Save styling response for learning
      aiContextService.saveChatMessage({
        userId,
        storeId: resolvedStoreId,
        sessionId,
        role: 'assistant',
        content: responseResult.content,
        intent: 'styling',
        operation: 'styling_applied',
        wasSuccessful: appliedChanges.length > 0,
        metadata: {
          appliedChanges,
          failedChanges: failedChanges.length,
          pageType
        }
      }).catch(err => console.error('Failed to save styling response:', err));

      res.json({
        success: true,
        message: responseResult.content,
        data: responseData,
        creditsDeducted: creditsUsed
      });
      return;

    } else if (intent.intent === 'analytics_query') {
      // Handle analytics/data queries
      console.log('[AI Chat] Entering analytics_query handler');
      console.log('[AI Chat] Analytics details:', JSON.stringify(intent.details));
      const ConnectionManager = require('../services/database/ConnectionManager');

      if (!resolvedStoreId) {
        return res.status(400).json({
          success: false,
          message: 'store_id is required for analytics queries'
        });
      }

      const tenantDb = await ConnectionManager.getStoreConnection(resolvedStoreId);
      const queryType = intent.details?.query_type || 'general';
      const filters = intent.details?.filters || {};
      const limit = filters.limit || 10;

      let queryResult = null;
      let queryDescription = '';

      try {
        // Build date filter based on period
        let dateFilter = null;
        if (filters.period) {
          const now = new Date();
          switch (filters.period) {
            case 'today':
              dateFilter = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
              break;
            case 'week':
              dateFilter = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
              break;
            case 'month':
              dateFilter = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
              break;
            case 'year':
              dateFilter = new Date(now.getFullYear(), 0, 1).toISOString();
              break;
          }
        }

        switch (queryType) {
          case 'best_selling':
            // Get best selling products by purchase_count
            let bestSellingQuery = tenantDb
              .from('products')
              .select('id, sku, price, stock_quantity, purchase_count, view_count, status')
              .eq('store_id', resolvedStoreId)
              .order('purchase_count', { ascending: false })
              .limit(limit);

            const { data: products } = await bestSellingQuery;

            // Get translations for product names
            if (products && products.length > 0) {
              const productIds = products.map(p => p.id);
              const { data: translations } = await tenantDb
                .from('product_translations')
                .select('product_id, name')
                .in('product_id', productIds)
                .eq('locale', 'en');

              const nameMap = {};
              (translations || []).forEach(t => { nameMap[t.product_id] = t.name; });
              products.forEach(p => { p.name = nameMap[p.id] || 'Unnamed'; });
            }

            queryResult = products || [];
            queryDescription = `Top ${limit} best selling products`;
            break;

          case 'revenue':
            // Get total revenue from paid orders
            let revenueQuery = tenantDb
              .from('sales_orders')
              .select('total_amount, created_at')
              .eq('store_id', resolvedStoreId)
              .eq('payment_status', 'paid');

            if (dateFilter) {
              revenueQuery = revenueQuery.gte('created_at', dateFilter);
            }

            const { data: revenueOrders } = await revenueQuery;
            const totalRevenue = (revenueOrders || []).reduce((sum, o) => sum + parseFloat(o.total_amount || 0), 0);
            const orderCount = (revenueOrders || []).length;

            queryResult = {
              total_revenue: totalRevenue.toFixed(2),
              order_count: orderCount,
              average_order_value: orderCount > 0 ? (totalRevenue / orderCount).toFixed(2) : '0.00',
              period: filters.period || 'all time'
            };
            queryDescription = `Revenue summary${filters.period ? ` for ${filters.period}` : ''}`;
            break;

          case 'orders':
            // Get order statistics
            let ordersQuery = tenantDb
              .from('sales_orders')
              .select('id, order_number, status, payment_status, total_amount, customer_email, created_at')
              .eq('store_id', resolvedStoreId)
              .order('created_at', { ascending: false })
              .limit(limit);

            if (dateFilter) {
              ordersQuery = ordersQuery.gte('created_at', dateFilter);
            }

            const { data: orders } = await ordersQuery;

            // Get counts by status
            const { data: statusCounts } = await tenantDb
              .from('sales_orders')
              .select('status')
              .eq('store_id', resolvedStoreId);

            const statusBreakdown = {};
            (statusCounts || []).forEach(o => {
              statusBreakdown[o.status] = (statusBreakdown[o.status] || 0) + 1;
            });

            queryResult = {
              recent_orders: orders || [],
              status_breakdown: statusBreakdown,
              total_count: (statusCounts || []).length
            };
            queryDescription = `Order statistics${filters.period ? ` for ${filters.period}` : ''}`;
            break;

          case 'customers':
            // Get customer data
            let customersQuery = tenantDb
              .from('customers')
              .select('id, email, first_name, last_name, total_spent, total_orders, last_order_date, created_at')
              .eq('store_id', resolvedStoreId)
              .order('total_spent', { ascending: false })
              .limit(limit);

            const { data: customers } = await customersQuery;

            queryResult = {
              top_customers: customers || [],
              total_count: (customers || []).length
            };
            queryDescription = `Top ${limit} customers by spending`;
            break;

          case 'out_of_stock':
            // Get only out of stock products
            const { data: outOfStockProducts, error: oosError } = await tenantDb
              .from('products')
              .select('id, sku, stock_quantity')
              .lte('stock_quantity', 0)
              .eq('status', 'active')
              .limit(filters.limit || 50);

            if (oosError) {
              throw new Error(`Failed to query products: ${oosError.message}`);
            }

            // Get names from product_translations (uses language_code, not locale)
            if (outOfStockProducts && outOfStockProducts.length > 0) {
              const oosIds = outOfStockProducts.map(p => p.id);
              const { data: oosNames } = await tenantDb
                .from('product_translations')
                .select('product_id, name')
                .in('product_id', oosIds)
                .eq('language_code', 'en');
              const oosNameMap = {};
              (oosNames || []).forEach(t => { oosNameMap[t.product_id] = t.name; });
              outOfStockProducts.forEach(p => { p.name = oosNameMap[p.id] || p.sku || 'Unnamed'; });
            }

            queryResult = {
              products: outOfStockProducts || [],
              count: (outOfStockProducts || []).length
            };
            queryDescription = 'Out of stock products';
            break;

          case 'low_stock':
            // Get only low stock products (not out of stock)
            // Note: Supabase doesn't support COALESCE in filters, so we get all low quantity and filter
            const { data: lowStockProducts, error: lsError } = await tenantDb
              .from('products')
              .select('id, sku, stock_quantity, low_stock_threshold')
              .gt('stock_quantity', 0)
              .lte('stock_quantity', 10) // Default threshold
              .eq('status', 'active')
              .limit(filters.limit || 50);

            if (lsError) {
              throw new Error(`Failed to query products: ${lsError.message}`);
            }

            // Filter by actual threshold
            const filteredLowStock = (lowStockProducts || []).filter(p =>
              p.stock_quantity <= (p.low_stock_threshold || 5)
            );

            if (filteredLowStock.length > 0) {
              const lsIds = filteredLowStock.map(p => p.id);
              const { data: lsNames } = await tenantDb
                .from('product_translations')
                .select('product_id, name')
                .in('product_id', lsIds)
                .eq('language_code', 'en');
              const lsNameMap = {};
              (lsNames || []).forEach(t => { lsNameMap[t.product_id] = t.name; });
              filteredLowStock.forEach(p => { p.name = lsNameMap[p.id] || p.sku || 'Unnamed'; });
            }

            queryResult = {
              products: filteredLowStock,
              count: filteredLowStock.length
            };
            queryDescription = 'Low stock products';
            break;

          case 'products_by_attribute_set':
            // Get products by attribute set
            const attrSetName = filters.attribute_set;
            if (!attrSetName) {
              queryResult = { error: 'Please specify an attribute set name' };
              queryDescription = 'Missing attribute set';
              break;
            }

            const attrSetProducts = await tenantDb('products')
              .select('products.id', 'products.sku', 'products.stock_quantity', 'attribute_sets.name as attribute_set_name')
              .join('attribute_sets', 'products.attribute_set_id', 'attribute_sets.id')
              .whereRaw('LOWER(attribute_sets.name) LIKE ?', [`%${attrSetName.toLowerCase()}%`])
              .where('products.status', 'active')
              .limit(filters.limit || 100);

            if (attrSetProducts.length > 0) {
              const asIds = attrSetProducts.map(p => p.id);
              const asNames = await tenantDb('product_translations')
                .select('product_id', 'name')
                .whereIn('product_id', asIds)
                .where('locale', 'en');
              const asNameMap = {};
              asNames.forEach(t => { asNameMap[t.product_id] = t.name; });
              attrSetProducts.forEach(p => { p.name = asNameMap[p.id] || 'Unnamed'; });
            }

            queryResult = {
              products: attrSetProducts,
              count: attrSetProducts.length,
              attribute_set: attrSetName
            };
            queryDescription = `Products with attribute set "${attrSetName}"`;
            break;

          case 'inventory':
            // Get low stock and out of stock products
            const { data: lowStock } = await tenantDb
              .from('products')
              .select('id, sku, stock_quantity, low_stock_threshold, status')
              .eq('store_id', resolvedStoreId)
              .eq('manage_stock', true)
              .eq('status', 'active')
              .order('stock_quantity', { ascending: true })
              .limit(20);

            // Get translations for product names
            if (lowStock && lowStock.length > 0) {
              const productIds = lowStock.map(p => p.id);
              const { data: translations } = await tenantDb
                .from('product_translations')
                .select('product_id, name')
                .in('product_id', productIds)
                .eq('locale', 'en');

              const nameMap = {};
              (translations || []).forEach(t => { nameMap[t.product_id] = t.name; });
              lowStock.forEach(p => { p.name = nameMap[p.id] || 'Unnamed'; });
            }

            const outOfStock = (lowStock || []).filter(p => p.stock_quantity <= 0);
            const lowStockItems = (lowStock || []).filter(p => p.stock_quantity > 0 && p.stock_quantity <= (p.low_stock_threshold || 5));

            queryResult = {
              out_of_stock: outOfStock,
              low_stock: lowStockItems,
              out_of_stock_count: outOfStock.length,
              low_stock_count: lowStockItems.length
            };
            queryDescription = 'Inventory status report';
            break;

          case 'product_sales':
            // Get sales figures for specific product or all products
            const productNameFilter = filters.product_name;
            let salesQuery = tenantDb('order_items')
              .select('order_items.product_id')
              .sum('order_items.quantity as total_sold')
              .sum('order_items.total as total_revenue')
              .groupBy('order_items.product_id')
              .orderBy('total_revenue', 'desc')
              .limit(filters.limit || 20);

            const productSales = await salesQuery;

            if (productSales.length > 0) {
              // Get product names
              const psIds = productSales.map(p => p.product_id);
              const psProducts = await tenantDb('products')
                .select('id', 'sku', 'price', 'cost_price')
                .whereIn('id', psIds);
              const psNames = await tenantDb('product_translations')
                .select('product_id', 'name')
                .whereIn('product_id', psIds)
                .where('locale', 'en');

              const psNameMap = {};
              const psProdMap = {};
              psNames.forEach(t => { psNameMap[t.product_id] = t.name; });
              psProducts.forEach(p => { psProdMap[p.id] = p; });

              productSales.forEach(ps => {
                ps.name = psNameMap[ps.product_id] || 'Unnamed';
                ps.sku = psProdMap[ps.product_id]?.sku || '';
                ps.price = psProdMap[ps.product_id]?.price || 0;
              });

              // Filter by product name if specified
              if (productNameFilter) {
                const filtered = productSales.filter(ps =>
                  ps.name.toLowerCase().includes(productNameFilter.toLowerCase()) ||
                  ps.sku.toLowerCase().includes(productNameFilter.toLowerCase())
                );
                queryResult = filtered.length > 0 ? filtered : { message: `No sales found for "${productNameFilter}"` };
              } else {
                queryResult = productSales;
              }
            } else {
              queryResult = { message: 'No sales data found' };
            }
            queryDescription = productNameFilter ? `Sales for "${productNameFilter}"` : 'Product sales report';
            break;

          case 'top_margin':
            // Get products with highest profit margin
            const marginProducts = await tenantDb('products')
              .select('id', 'sku', 'price', 'cost_price', 'purchase_count')
              .whereNotNull('cost_price')
              .where('cost_price', '>', 0)
              .where('status', 'active')
              .orderByRaw('(price - cost_price) DESC')
              .limit(filters.limit || 20);

            if (marginProducts.length > 0) {
              const mIds = marginProducts.map(p => p.id);
              const mNames = await tenantDb('product_translations')
                .select('product_id', 'name')
                .whereIn('product_id', mIds)
                .where('locale', 'en');

              const mNameMap = {};
              mNames.forEach(t => { mNameMap[t.product_id] = t.name; });

              marginProducts.forEach(p => {
                p.name = mNameMap[p.id] || 'Unnamed';
                p.margin = parseFloat(p.price) - parseFloat(p.cost_price);
                p.margin_percent = ((p.margin / parseFloat(p.price)) * 100).toFixed(1);
              });
            }

            queryResult = marginProducts;
            queryDescription = 'Products with highest profit margin';
            break;

          case 'sales_by_product':
            // Comprehensive sales report by product
            const salesReport = await tenantDb('order_items')
              .select('product_id')
              .sum('quantity as units_sold')
              .sum('total as revenue')
              .count('* as order_count')
              .groupBy('product_id')
              .orderBy('revenue', 'desc')
              .limit(filters.limit || 50);

            if (salesReport.length > 0) {
              const srIds = salesReport.map(s => s.product_id);
              const srProducts = await tenantDb('products')
                .select('id', 'sku', 'price', 'cost_price')
                .whereIn('id', srIds);
              const srNames = await tenantDb('product_translations')
                .select('product_id', 'name')
                .whereIn('product_id', srIds)
                .where('locale', 'en');

              const srNameMap = {};
              const srProdMap = {};
              srNames.forEach(t => { srNameMap[t.product_id] = t.name; });
              srProducts.forEach(p => { srProdMap[p.id] = p; });

              salesReport.forEach(sr => {
                sr.name = srNameMap[sr.product_id] || 'Unnamed';
                sr.sku = srProdMap[sr.product_id]?.sku || '';
                const costPrice = parseFloat(srProdMap[sr.product_id]?.cost_price || 0);
                const unitPrice = parseFloat(srProdMap[sr.product_id]?.price || 0);
                sr.profit = costPrice > 0 ? (parseFloat(sr.revenue) - (costPrice * parseInt(sr.units_sold))).toFixed(2) : 'N/A';
                sr.avg_order_value = (parseFloat(sr.revenue) / parseInt(sr.order_count)).toFixed(2);
              });
            }

            queryResult = salesReport;
            queryDescription = 'Sales report by product';
            break;

          case 'categories':
            // Get categories with hierarchy and status
            const statusFilter = filters.status;
            let categoriesQuery = tenantDb('categories')
              .select(
                'categories.id',
                'categories.slug',
                'categories.is_active',
                'categories.hide_in_menu',
                'categories.level',
                'categories.parent_id',
                'categories.product_count',
                'categories.sort_order'
              )
              .orderBy('categories.level')
              .orderBy('categories.sort_order');

            if (statusFilter === 'active') {
              categoriesQuery = categoriesQuery.where('categories.is_active', true);
            } else if (statusFilter === 'inactive') {
              categoriesQuery = categoriesQuery.where('categories.is_active', false);
            }

            const categoriesData = await categoriesQuery.limit(filters.limit || 100);

            // Get translations for category names
            if (categoriesData && categoriesData.length > 0) {
              const categoryIds = categoriesData.map(c => c.id);
              const categoryNames = await tenantDb('category_translations')
                .select('category_id', 'name', 'description')
                .whereIn('category_id', categoryIds)
                .where('language_code', 'en');

              const catNameMap = {};
              categoryNames.forEach(t => {
                catNameMap[t.category_id] = { name: t.name, description: t.description };
              });
              categoriesData.forEach(c => {
                c.name = catNameMap[c.id]?.name || c.slug;
                c.description = catNameMap[c.id]?.description || '';
              });
            }

            const activeCount = categoriesData.filter(c => c.is_active).length;
            const inactiveCount = categoriesData.filter(c => !c.is_active).length;
            const rootCategories = categoriesData.filter(c => !c.parent_id);

            queryResult = {
              categories: categoriesData,
              summary: {
                total: categoriesData.length,
                active: activeCount,
                inactive: inactiveCount,
                root_categories: rootCategories.length
              }
            };
            queryDescription = statusFilter ? `${statusFilter} categories` : 'All categories';
            break;

          case 'attributes':
            // Get all attributes with their options
            const attributesData = await tenantDb('attributes')
              .select('id', 'code', 'type', 'is_filterable', 'is_required', 'sort_order', 'is_active')
              .orderBy('sort_order');

            // Get translations
            if (attributesData && attributesData.length > 0) {
              const attrIds = attributesData.map(a => a.id);
              const attrNames = await tenantDb('attribute_translations')
                .select('attribute_id', 'name')
                .whereIn('attribute_id', attrIds)
                .where('language_code', 'en');

              const attrNameMap = {};
              attrNames.forEach(t => { attrNameMap[t.attribute_id] = t.name; });
              attributesData.forEach(a => { a.name = attrNameMap[a.id] || a.code; });

              // Get option counts
              const optionCounts = await tenantDb('attribute_options')
                .select('attribute_id')
                .count('* as count')
                .whereIn('attribute_id', attrIds)
                .groupBy('attribute_id');

              const countMap = {};
              optionCounts.forEach(oc => { countMap[oc.attribute_id] = parseInt(oc.count); });
              attributesData.forEach(a => { a.option_count = countMap[a.id] || 0; });
            }

            queryResult = {
              attributes: attributesData,
              total: attributesData.length,
              filterable: attributesData.filter(a => a.is_filterable).length
            };
            queryDescription = 'Store attributes';
            break;

          case 'payment_methods':
            // Get payment methods
            const paymentMethods = await tenantDb('payment_methods')
              .select('id', 'code', 'name', 'is_active', 'is_default', 'sort_order', 'min_order_amount', 'max_order_amount')
              .orderBy('sort_order');

            queryResult = {
              payment_methods: paymentMethods,
              active: paymentMethods.filter(p => p.is_active).length,
              total: paymentMethods.length
            };
            queryDescription = 'Payment methods';
            break;

          case 'shipping_methods':
            // Get shipping methods
            const shippingMethods = await tenantDb('shipping_methods')
              .select('id', 'code', 'name', 'is_active', 'base_rate', 'free_shipping_threshold', 'estimated_days_min', 'estimated_days_max')
              .orderBy('sort_order');

            queryResult = {
              shipping_methods: shippingMethods,
              active: shippingMethods.filter(s => s.is_active).length,
              total: shippingMethods.length
            };
            queryDescription = 'Shipping methods';
            break;

          case 'coupons':
            // Get coupons
            let couponsQuery = tenantDb('coupons')
              .select('id', 'code', 'discount_type', 'discount_value', 'is_active', 'starts_at', 'expires_at', 'usage_count', 'usage_limit')
              .orderBy('created_at', 'desc');

            if (filters.status === 'active') {
              couponsQuery = couponsQuery.where('is_active', true);
            }

            const couponsData = await couponsQuery.limit(filters.limit || 50);

            // Check validity
            const now = new Date();
            couponsData.forEach(c => {
              c.is_valid = c.is_active &&
                (!c.starts_at || new Date(c.starts_at) <= now) &&
                (!c.expires_at || new Date(c.expires_at) >= now) &&
                (!c.usage_limit || c.usage_count < c.usage_limit);
            });

            queryResult = {
              coupons: couponsData,
              active: couponsData.filter(c => c.is_active).length,
              valid: couponsData.filter(c => c.is_valid).length,
              total: couponsData.length
            };
            queryDescription = 'Store coupons';
            break;

          default:
            // General query - let AI interpret
            queryResult = { message: 'Query type not recognized. Try: best selling products, revenue, orders, customers, inventory, categories, attributes, payment_methods, shipping_methods, coupons, or sales_by_product.' };
            queryDescription = 'Unknown query type';
        }

        // Get learning context from approved training data
        const learningContext = await aiContextService.getLearningContext('analytics_query', queryType);

        // Generate natural language response
        const analyticsResponsePrompt = `User asked: "${message}"

Data found:
${JSON.stringify(queryResult, null, 2)}

Be SHORT and direct. Just list the results with bullet points. No fluff, no explanations.`;

        const analyticsResponse = await aiService.generate({
          userId,
          operationType: 'general',
          modelId,
          serviceKey,
          prompt: analyticsResponsePrompt,
          systemPrompt: 'Be extremely concise. Just list the data with bullet points. No introductions, no conclusions, no explanations. Short answers only.',
          maxTokens: 500,
          temperature: 0.3,
          metadata: { type: 'analytics-response', storeId: resolvedStoreId, modelId }
        });
        creditsUsed += analyticsResponse.creditsDeducted;

        // Update training candidate with response and outcome
        if (trainingCandidateId) {
          await aiTrainingService.updateOutcome(trainingCandidateId, 'success', {
            query_executed: true,
            query_type: queryType,
            result_count: Array.isArray(queryResult) ? queryResult.length : (queryResult?.categories?.length || queryResult?.total || 1),
            ai_response: analyticsResponse.content?.substring(0, 500)
          });
        }

        res.json({
          success: true,
          message: analyticsResponse.content,
          data: {
            type: 'analytics_result',
            query_type: queryType,
            description: queryDescription,
            result: queryResult
          },
          creditsDeducted: creditsUsed
        });
        return;

      } catch (queryError) {
        console.error('[AI Chat] Analytics query error:', queryError);
        return res.json({
          success: true,
          message: `I encountered an error while running that query: ${queryError.message}. Please try a different question.`,
          data: { type: 'analytics_error', error: queryError.message },
          creditsDeducted: creditsUsed
        });
      }

    } else if (intent.intent === 'job_trigger') {
      // Handle background job triggering
      console.log('[AI Chat] Entering job_trigger handler');
      console.log('[AI Chat] Job details:', JSON.stringify(intent.details));

      if (!resolvedStoreId) {
        return res.status(400).json({
          success: false,
          message: 'store_id is required for job operations'
        });
      }

      const jobType = intent.details?.job_type;
      const priority = intent.details?.priority || 'normal';

      if (!jobType) {
        return res.json({
          success: true,
          message: "I couldn't determine which job you want to run. Available jobs:\n• **akeneo:import:products** - Import products from Akeneo\n• **akeneo:import:categories** - Import categories from Akeneo\n• **shopify:import:products** - Import from Shopify\n• **export:products** - Export product data\n\nExample: 'run akeneo product import'",
          data: { type: 'job_clarification' },
          creditsDeducted: creditsUsed
        });
      }

      try {
        // Create job in master database using masterDbClient
        const { masterDbClient } = require('../database/masterConnection');
        const { v4: uuidv4 } = require('uuid');

        if (!masterDbClient) {
          throw new Error('Database not available');
        }

        const jobId = uuidv4();
        const { data: job, error } = await masterDbClient
          .from('job_queue')
          .insert({
            id: jobId,
            job_type: jobType,
            priority: priority,
            status: 'pending',
            store_id: resolvedStoreId,
            user_id: userId,
            payload: intent.details?.payload || {},
            scheduled_at: new Date().toISOString(),
            metadata: {
              triggered_by: 'ai_chat',
              message: message
            }
          })
          .select()
          .single();

        if (error) {
          throw new Error(error.message);
        }

        console.log('[AI Chat] Created job:', job.id, jobType);

        res.json({
          success: true,
          message: `I've queued the **${jobType}** job with ${priority} priority. Job ID: \`${job.id}\`\n\nThe job will start processing shortly. You can check its status in the Jobs section of the admin panel.`,
          data: {
            type: 'job_created',
            job_id: job.id,
            job_type: jobType,
            priority: priority,
            status: 'pending'
          },
          creditsDeducted: creditsUsed
        });
        return;

      } catch (jobError) {
        console.error('[AI Chat] Job trigger error:', jobError);
        return res.json({
          success: true,
          message: `I couldn't create the job: ${jobError.message}. Please try again or contact support.`,
          data: { type: 'job_error', error: jobError.message },
          creditsDeducted: creditsUsed
        });
      }

    } else if (intent.intent === 'settings_update') {
      // Handle theme/store settings updates
      console.log('[AI Chat] Entering settings_update handler');
      console.log('[AI Chat] Settings details:', JSON.stringify(intent.details));
      const ConnectionManager = require('../services/database/ConnectionManager');

      if (!resolvedStoreId) {
        return res.status(400).json({
          success: false,
          message: 'store_id is required for settings updates'
        });
      }

      const settingPath = intent.details?.setting_path;
      let newValue = intent.details?.value;

      // Server-side fix: Correct value logic for hide_/show_ settings
      // This corrects AI mistakes where "show X" for "hide_X" setting returns true instead of false
      const lastPathPart = settingPath?.split('.').pop() || '';
      const userMessage = message.toLowerCase();

      if (lastPathPart.startsWith('hide_')) {
        // For hide_* settings: "show" = false (not hiding), "hide" = true (hiding)
        if (userMessage.includes('show') && !userMessage.includes('hide')) {
          newValue = false;
          console.log('[AI Chat] Corrected hide_* setting: show -> false');
        } else if (userMessage.includes('hide')) {
          newValue = true;
        }
      } else if (lastPathPart.startsWith('show_') || lastPathPart.includes('show_')) {
        // For show_* settings: "show" = true, "hide" = false
        if (userMessage.includes('show') && !userMessage.includes('hide')) {
          newValue = true;
        } else if (userMessage.includes('hide')) {
          newValue = false;
          console.log('[AI Chat] Corrected show_* setting: hide -> false');
        }
      }

      if (!settingPath || newValue === undefined) {
        return res.json({
          success: true,
          message: "I couldn't determine which setting you want to change. You can update:\n\n**Display toggles:**\n• 'hide stock label' / 'show stock label'\n• 'hide currency on product page'\n• 'hide quantity selector'\n\n**Theme colors:**\n• 'change breadcrumb color to blue'\n• 'set primary color to #FF5500'\n\n**Features:**\n• 'enable guest checkout'\n• 'show product filters'\n\nPlease be specific about what you want to change.",
          data: { type: 'settings_clarification' },
          creditsDeducted: creditsUsed
        });
      }

      try {
        const tenantDb = await ConnectionManager.getStoreConnection(resolvedStoreId);

        // Fetch current store settings
        const { data: store, error: fetchError } = await tenantDb
          .from('stores')
          .select('id, settings')
          .eq('id', resolvedStoreId)
          .single();

        if (fetchError || !store) {
          throw new Error('Could not fetch store settings');
        }

        // Parse the setting path (e.g., "theme.breadcrumb_item_text_color")
        const pathParts = settingPath.split('.');
        let currentSettings = JSON.parse(JSON.stringify(store.settings || {}));

        // Navigate to the parent and set the value
        let target = currentSettings;
        for (let i = 0; i < pathParts.length - 1; i++) {
          if (!target[pathParts[i]]) {
            target[pathParts[i]] = {};
          }
          target = target[pathParts[i]];
        }

        const lastKey = pathParts[pathParts.length - 1];
        const oldValue = target[lastKey];
        target[lastKey] = newValue;

        // Update the store settings
        const { error: updateError } = await tenantDb
          .from('stores')
          .update({
            settings: currentSettings,
            updated_at: new Date().toISOString()
          })
          .eq('id', resolvedStoreId);

        if (updateError) {
          throw new Error(`Failed to update settings: ${updateError.message}`);
        }

        console.log('[AI Chat] Updated setting:', settingPath, 'from', oldValue, 'to', newValue);

        // Generate friendly response
        const settingName = lastKey.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());

        // Track successful operation for self-learning
        trackSuccessfulOperation(
          resolvedStoreId,
          req.user.id,
          message,
          'settings_update',
          'store_settings',
          'update',
          `Updated ${settingPath} to ${newValue}`
        );

        res.json({
          success: true,
          message: `Done! I've updated **${settingName}** to \`${newValue}\`.\n\nRefresh the page to see the changes.`,
          data: {
            type: 'settings_updated',
            setting_path: settingPath,
            old_value: oldValue,
            new_value: newValue
          },
          creditsDeducted: creditsUsed
        });
        return;

      } catch (settingsError) {
        console.error('[AI Chat] Settings update error:', settingsError);
        return res.json({
          success: true,
          message: `I couldn't update that setting: ${settingsError.message}. Please try again.`,
          data: { type: 'settings_error', error: settingsError.message },
          creditsDeducted: creditsUsed
        });
      }

    } else if (intent.intent === 'category_management') {
      // Handle adding/removing products to/from categories
      console.log('[AI Chat] Entering category_management handler');
      console.log('[AI Chat] Category management details:', JSON.stringify(intent.details));
      const ConnectionManager = require('../services/database/ConnectionManager');

      if (!resolvedStoreId) {
        return res.status(400).json({
          success: false,
          message: 'store_id is required for category management'
        });
      }

      const operation = intent.details?.operation || 'add';
      const categoryName = intent.details?.category_name;
      const productFilter = intent.details?.product_filter || 'all';

      if (!categoryName) {
        // Fetch available categories to show as options
        const tenantDb = await ConnectionManager.getStoreConnection(resolvedStoreId);
        const availableCategories = await tenantDb('categories')
          .select('id', 'name')
          .where('is_active', true)
          .orderBy('name')
          .limit(6);

        return res.json({
          success: true,
          message: "Which category would you like to work with?",
          data: {
            type: 'clarification_needed',
            clarification: {
              type: 'category_select',
              question: 'Select a category:',
              options: availableCategories.map(c => ({
                label: c.name,
                value: c.name,
                action: `${operation} products to ${c.name} category`
              }))
            }
          },
          creditsDeducted: creditsUsed
        });
      }

      try {
        const tenantDb = await ConnectionManager.getStoreConnection(resolvedStoreId);

        // Find the category by name (case-insensitive search)
        let categories = await tenantDb('categories')
          .whereRaw('LOWER(name) LIKE ?', [`%${categoryName.toLowerCase()}%`])
          .select('id', 'name');

        // Handle create_and_add operation - create category if it doesn't exist
        if (categories.length === 0 && operation === 'create_and_add') {
          // Create the new category
          const slug = categoryName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
          const [newCategoryId] = await tenantDb('categories').insert({
            name: categoryName,
            slug: slug,
            url_key: slug,
            is_active: true,
            include_in_menu: true,
            position: 0,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          });

          // Fetch the created category
          const newCategory = await tenantDb('categories').where('id', newCategoryId).first();
          categories = [{ id: newCategoryId, name: newCategory.name }];
          console.log(`[AI Chat] Created new category: ${categoryName} (ID: ${newCategoryId})`);
        }

        if (categories.length === 0) {
          // Get similar categories to suggest as alternatives
          const similarCategories = await tenantDb('categories')
            .select('id', 'name')
            .where('is_active', true)
            .orderBy('name')
            .limit(4);

          // Build options: first option is to create new category, then existing ones
          const options = [
            {
              label: `Create "${categoryName}"`,
              value: categoryName,
              action: `create category ${categoryName} and add ${productFilter} to it`,
              isCreate: true
            },
            ...similarCategories.map(c => ({
              label: c.name,
              value: c.name,
              action: `add ${productFilter} to ${c.name} category`
            }))
          ];

          return res.json({
            success: true,
            message: `Category "${categoryName}" doesn't exist yet.`,
            data: {
              type: 'clarification_needed',
              clarification: {
                type: 'category_select',
                question: 'Would you like to create it or use an existing category?',
                options
              }
            },
            creditsDeducted: creditsUsed
          });
        }

        if (categories.length > 1) {
          return res.json({
            success: true,
            message: `Found multiple categories matching "${categoryName}".`,
            data: {
              type: 'clarification_needed',
              clarification: {
                type: 'category_select',
                question: 'Which category did you mean?',
                options: categories.map(c => ({
                  label: c.name,
                  value: c.name,
                  action: `${operation} ${productFilter} to ${c.name} category`
                }))
              }
            },
            creditsDeducted: creditsUsed
          });
        }

        const targetCategory = categories[0];

        // Get products to assign
        let productsQuery = tenantDb('products').select('products.id', 'products.sku');

        // Apply attribute set filter if provided
        const attributeSetFilter = intent.details?.attribute_set;
        if (attributeSetFilter) {
          // Join with attribute_sets table
          productsQuery = productsQuery
            .join('attribute_sets', 'products.attribute_set_id', 'attribute_sets.id')
            .whereRaw('LOWER(attribute_sets.name) LIKE ?', [`%${attributeSetFilter.toLowerCase()}%`]);
          console.log('[AI Chat] Filtering by attribute set:', attributeSetFilter);
        }

        // Apply product filter if not "all"
        if (productFilter === 'out_of_stock') {
          productsQuery = productsQuery.where('products.stock_quantity', '<=', 0);
        } else if (productFilter !== 'all') {
          productsQuery = productsQuery.whereRaw('LOWER(products.name) LIKE ? OR LOWER(products.sku) LIKE ?',
            [`%${productFilter.toLowerCase()}%`, `%${productFilter.toLowerCase()}%`]);
        }

        const products = await productsQuery;

        if (products.length === 0) {
          if (productFilter === 'all') {
            return res.json({
              success: true,
              message: "There are no products in your store to assign.",
              data: { type: 'no_products_found' },
              creditsDeducted: creditsUsed
            });
          }

          // Search for similar products to suggest
          const similarProducts = await tenantDb('products')
            .select('id', 'name', 'sku')
            .whereRaw('LOWER(name) LIKE ?', [`%${productFilter.toLowerCase().split(' ')[0]}%`])
            .orWhereRaw('LOWER(sku) LIKE ?', [`%${productFilter.toLowerCase()}%`])
            .limit(6);

          if (similarProducts.length > 0) {
            return res.json({
              success: true,
              message: `I couldn't find a product matching "${productFilter}".`,
              data: {
                type: 'clarification_needed',
                clarification: {
                  type: 'product_select',
                  question: 'Did you mean one of these products?',
                  options: similarProducts.map(p => ({
                    label: p.name,
                    sublabel: p.sku,
                    value: p.name,
                    action: `add ${p.name} to ${targetCategory.name} category`
                  }))
                }
              },
              creditsDeducted: creditsUsed
            });
          }

          return res.json({
            success: true,
            message: `I couldn't find any products matching "${productFilter}". Please check the product name and try again.`,
            data: { type: 'no_products_found' },
            creditsDeducted: creditsUsed
          });
        }

        let assignedCount = 0;
        let alreadyAssignedCount = 0;
        let removedCount = 0;

        // Track if we created a new category (for messaging)
        const categoryWasCreated = operation === 'create_and_add';

        if (operation === 'add' || operation === 'create_and_add') {
          // Add products to category
          for (const product of products) {
            // Check if already assigned
            const existing = await tenantDb('product_categories')
              .where({ product_id: product.id, category_id: targetCategory.id })
              .first();

            if (!existing) {
              await tenantDb('product_categories').insert({
                product_id: product.id,
                category_id: targetCategory.id,
                created_at: new Date().toISOString()
              });
              assignedCount++;
            } else {
              alreadyAssignedCount++;
            }
          }

          let message;
          if (categoryWasCreated) {
            message = assignedCount > 0
              ? `Done! I've created the "${targetCategory.name}" category and added ${assignedCount} product(s) to it.`
              : `Created the "${targetCategory.name}" category, but no new products were added.`;
          } else {
            message = assignedCount > 0
              ? `Done! I've added ${assignedCount} product(s) to the "${targetCategory.name}" category.${alreadyAssignedCount > 0 ? ` (${alreadyAssignedCount} were already in this category)` : ''}`
              : `All ${alreadyAssignedCount} product(s) were already in the "${targetCategory.name}" category.`;
          }

          // Track successful operation for self-learning
          if (assignedCount > 0) {
            trackSuccessfulOperation(
              resolvedStoreId,
              req.user.id,
              message,
              'category_management',
              'category',
              'add_products',
              `Added ${assignedCount} products to ${targetCategory.name}`
            );
          }

          res.json({
            success: true,
            message: message,
            data: {
              type: 'category_products_added',
              category: targetCategory,
              assigned_count: assignedCount,
              already_assigned_count: alreadyAssignedCount,
              total_products: products.length
            },
            creditsDeducted: creditsUsed
          });
          return;

        } else if (operation === 'remove') {
          // Remove products from category
          for (const product of products) {
            const deleted = await tenantDb('product_categories')
              .where({ product_id: product.id, category_id: targetCategory.id })
              .delete();
            if (deleted) removedCount++;
          }

          // Track successful operation for self-learning
          if (removedCount > 0) {
            trackSuccessfulOperation(
              resolvedStoreId,
              req.user.id,
              message,
              'category_management',
              'category',
              'remove_products',
              `Removed ${removedCount} products from ${targetCategory.name}`
            );
          }

          res.json({
            success: true,
            message: removedCount > 0
              ? `Done! I've removed ${removedCount} product(s) from the "${targetCategory.name}" category.`
              : `None of the selected products were in the "${targetCategory.name}" category.`,
            data: {
              type: 'category_products_removed',
              category: targetCategory,
              removed_count: removedCount,
              total_products: products.length
            },
            creditsDeducted: creditsUsed
          });
          return;
        }

      } catch (categoryError) {
        console.error('[AI Chat] Category management error:', categoryError);
        return res.json({
          success: true,
          message: `I couldn't complete the category operation: ${categoryError.message}. Please try again.`,
          data: { type: 'category_error', error: categoryError.message },
          creditsDeducted: creditsUsed
        });
      }

    } else if (intent.intent === 'attribute_management') {
      // Handle attribute creation and management
      console.log('[AI Chat] Entering attribute_management handler');
      const ConnectionManager = require('../services/database/ConnectionManager');

      if (!resolvedStoreId) {
        return res.status(400).json({ success: false, message: 'store_id is required' });
      }

      const operation = intent.details?.operation || 'create_attribute';
      const attributeName = intent.details?.attribute_name;
      const values = intent.details?.values || [];

      try {
        const tenantDb = await ConnectionManager.getStoreConnection(resolvedStoreId);

        if (operation === 'create_attribute') {
          // Check if attribute exists
          const existing = await tenantDb('attributes')
            .whereRaw('LOWER(name) = ?', [attributeName.toLowerCase()])
            .first();

          if (existing) {
            return res.json({
              success: true,
              message: `Attribute "${attributeName}" already exists. Use "add value X to ${attributeName}" to add values.`,
              creditsDeducted: creditsUsed
            });
          }

          // Create attribute
          const [newAttr] = await tenantDb('attributes').insert({
            name: attributeName,
            code: attributeName.toLowerCase().replace(/\s+/g, '_'),
            type: 'select',
            is_filterable: true,
            is_visible: true,
            created_at: new Date().toISOString()
          }).returning('*');

          // Add values if provided
          if (values.length > 0) {
            for (let i = 0; i < values.length; i++) {
              await tenantDb('attribute_values').insert({
                attribute_id: newAttr.id,
                value: values[i],
                sort_order: i,
                created_at: new Date().toISOString()
              });
            }
          }

          res.json({
            success: true,
            message: `Created attribute "${attributeName}"${values.length > 0 ? ` with values: ${values.join(', ')}` : ''}.`,
            data: { type: 'attribute_created', attribute: newAttr, values },
            creditsDeducted: creditsUsed
          });
          return;

        } else if (operation === 'add_value') {
          const valueToAdd = intent.details?.value_to_add || intent.details?.values?.[0];
          const attr = await tenantDb('attributes')
            .whereRaw('LOWER(name) LIKE ?', [`%${attributeName.toLowerCase()}%`])
            .first();

          if (!attr) {
            return res.json({
              success: true,
              message: `Attribute "${attributeName}" not found.`,
              creditsDeducted: creditsUsed
            });
          }

          await tenantDb('attribute_values').insert({
            attribute_id: attr.id,
            value: valueToAdd,
            created_at: new Date().toISOString()
          });

          res.json({
            success: true,
            message: `Added "${valueToAdd}" to ${attr.name} attribute.`,
            data: { type: 'attribute_value_added', attribute: attr.name, value: valueToAdd },
            creditsDeducted: creditsUsed
          });
          return;
        }

      } catch (attrError) {
        console.error('[AI Chat] Attribute management error:', attrError);
        return res.json({
          success: true,
          message: `Couldn't manage attribute: ${attrError.message}`,
          creditsDeducted: creditsUsed
        });
      }

    } else if (intent.intent === 'product_label_management') {
      // Handle product label/badge management
      console.log('[AI Chat] Entering product_label_management handler');
      const ConnectionManager = require('../services/database/ConnectionManager');

      if (!resolvedStoreId) {
        return res.status(400).json({ success: false, message: 'store_id is required' });
      }

      const operation = intent.details?.operation || 'create';
      const labelName = intent.details?.label_name;
      const labelColor = intent.details?.label_color || '#FF5722';

      try {
        const tenantDb = await ConnectionManager.getStoreConnection(resolvedStoreId);

        if (operation === 'create') {
          const [newLabel] = await tenantDb('product_labels').insert({
            name: labelName,
            color: labelColor,
            is_active: true,
            created_at: new Date().toISOString()
          }).returning('*');

          res.json({
            success: true,
            message: `Created product label "${labelName}" with color ${labelColor}.`,
            data: { type: 'label_created', label: newLabel },
            creditsDeducted: creditsUsed
          });
          return;
        }

      } catch (labelError) {
        console.error('[AI Chat] Label management error:', labelError);
        return res.json({
          success: true,
          message: `Couldn't manage label: ${labelError.message}`,
          creditsDeducted: creditsUsed
        });
      }

    } else if (intent.intent === 'product_tab_management') {
      // Handle product tab management
      console.log('[AI Chat] Entering product_tab_management handler');
      const ConnectionManager = require('../services/database/ConnectionManager');

      if (!resolvedStoreId) {
        return res.status(400).json({ success: false, message: 'store_id is required' });
      }

      const operation = intent.details?.operation || 'create';
      const tabName = intent.details?.tab_name;
      const newName = intent.details?.new_name;

      try {
        const tenantDb = await ConnectionManager.getStoreConnection(resolvedStoreId);

        if (operation === 'create') {
          const maxSort = await tenantDb('product_tabs').max('sort_order as max').first();
          const [newTab] = await tenantDb('product_tabs').insert({
            name: tabName,
            slug: tabName.toLowerCase().replace(/\s+/g, '-'),
            is_active: true,
            sort_order: (maxSort?.max || 0) + 1,
            created_at: new Date().toISOString()
          }).returning('*');

          res.json({
            success: true,
            message: `Created product tab "${tabName}".`,
            data: { type: 'tab_created', tab: newTab },
            creditsDeducted: creditsUsed
          });
          return;

        } else if (operation === 'update' && newName) {
          const tab = await tenantDb('product_tabs')
            .whereRaw('LOWER(name) LIKE ?', [`%${tabName.toLowerCase()}%`])
            .first();

          if (!tab) {
            return res.json({
              success: true,
              message: `Tab "${tabName}" not found.`,
              creditsDeducted: creditsUsed
            });
          }

          await tenantDb('product_tabs')
            .where('id', tab.id)
            .update({ name: newName, updated_at: new Date().toISOString() });

          res.json({
            success: true,
            message: `Renamed tab "${tab.name}" to "${newName}".`,
            data: { type: 'tab_updated', old_name: tab.name, new_name: newName },
            creditsDeducted: creditsUsed
          });
          return;
        }

      } catch (tabError) {
        console.error('[AI Chat] Tab management error:', tabError);
        return res.json({
          success: true,
          message: `Couldn't manage tab: ${tabError.message}`,
          creditsDeducted: creditsUsed
        });
      }

    } else if (intent.intent === 'customer_management') {
      // Handle customer operations (blacklist, etc.)
      console.log('[AI Chat] Entering customer_management handler');
      const ConnectionManager = require('../services/database/ConnectionManager');

      if (!resolvedStoreId) {
        return res.status(400).json({ success: false, message: 'store_id is required' });
      }

      const operation = intent.details?.operation || 'get_details';
      const customerIdentifier = intent.details?.customer_identifier;
      const reason = intent.details?.reason || 'Blocked by admin';

      try {
        const tenantDb = await ConnectionManager.getStoreConnection(resolvedStoreId);

        // Find customer by email or ID (customers table has blacklist columns)
        let customer = await tenantDb('customers')
          .where('email', customerIdentifier)
          .orWhere('id', customerIdentifier)
          .first();

        if (!customer) {
          return res.json({
            success: true,
            message: `Customer "${customerIdentifier}" not found.`,
            creditsDeducted: creditsUsed
          });
        }

        if (operation === 'blacklist') {
          await tenantDb('customers')
            .where('id', customer.id)
            .update({
              is_blacklisted: true,
              blacklist_reason: reason,
              updated_at: new Date().toISOString()
            });

          res.json({
            success: true,
            message: `Blacklisted customer ${customer.email}. Reason: ${reason}`,
            data: { type: 'customer_blacklisted', customer_email: customer.email },
            creditsDeducted: creditsUsed
          });
          return;

        } else if (operation === 'unblacklist') {
          await tenantDb('customers')
            .where('id', customer.id)
            .update({
              is_blacklisted: false,
              blacklist_reason: null,
              updated_at: new Date().toISOString()
            });

          res.json({
            success: true,
            message: `Removed ${customer.email} from blacklist.`,
            data: { type: 'customer_unblacklisted', customer_email: customer.email },
            creditsDeducted: creditsUsed
          });
          return;

        } else if (operation === 'get_details') {
          // Get customer orders
          const orders = await tenantDb('orders')
            .where('customer_id', customer.id)
            .select('id', 'total', 'status', 'created_at')
            .orderBy('created_at', 'desc')
            .limit(5);

          const totalSpent = orders.reduce((sum, o) => sum + parseFloat(o.total || 0), 0);

          res.json({
            success: true,
            message: `Customer: ${customer.first_name} ${customer.last_name} (${customer.email})\nTotal orders: ${orders.length}\nTotal spent: ${totalSpent.toFixed(2)}\nBlacklisted: ${customer.is_blacklisted ? 'Yes' : 'No'}`,
            data: { type: 'customer_details', customer, orders, total_spent: totalSpent },
            creditsDeducted: creditsUsed
          });
          return;
        }

      } catch (custError) {
        console.error('[AI Chat] Customer management error:', custError);
        return res.json({
          success: true,
          message: `Couldn't manage customer: ${custError.message}`,
          creditsDeducted: creditsUsed
        });
      }

    } else if (intent.intent === 'cms_management') {
      // Handle CMS pages and blocks
      console.log('[AI Chat] Entering cms_management handler');
      const ConnectionManager = require('../services/database/ConnectionManager');

      if (!resolvedStoreId) {
        return res.status(400).json({ success: false, message: 'store_id is required' });
      }

      const operation = intent.details?.operation || 'create_page';
      const title = intent.details?.title;
      const identifier = intent.details?.identifier || title?.toLowerCase().replace(/\s+/g, '-');
      const contentText = intent.details?.content || '';

      try {
        const tenantDb = await ConnectionManager.getStoreConnection(resolvedStoreId);

        if (operation === 'create_page') {
          const [newPage] = await tenantDb('cms_pages').insert({
            title: title,
            identifier: identifier,
            content: contentText,
            is_active: true,
            store_id: resolvedStoreId,
            created_at: new Date().toISOString()
          }).returning('*');

          res.json({
            success: true,
            message: `Created CMS page "${title}" (URL: /${identifier}).`,
            data: { type: 'cms_page_created', page: newPage },
            creditsDeducted: creditsUsed
          });
          return;

        } else if (operation === 'create_block') {
          const [newBlock] = await tenantDb('cms_blocks').insert({
            title: title,
            identifier: identifier,
            content: contentText,
            is_active: true,
            store_id: resolvedStoreId,
            created_at: new Date().toISOString()
          }).returning('*');

          res.json({
            success: true,
            message: `Created CMS block "${title}" (identifier: ${identifier}).`,
            data: { type: 'cms_block_created', block: newBlock },
            creditsDeducted: creditsUsed
          });
          return;

        } else if (operation === 'update_page') {
          const page = await tenantDb('cms_pages')
            .whereRaw('LOWER(title) LIKE ?', [`%${title.toLowerCase()}%`])
            .first();

          if (!page) {
            return res.json({
              success: true,
              message: `CMS page "${title}" not found.`,
              creditsDeducted: creditsUsed
            });
          }

          const updates = { updated_at: new Date().toISOString() };
          if (contentText) updates.content = contentText;
          if (intent.details?.new_title) updates.title = intent.details.new_title;

          await tenantDb('cms_pages').where('id', page.id).update(updates);

          res.json({
            success: true,
            message: `Updated CMS page "${page.title}".`,
            data: { type: 'cms_page_updated', page_id: page.id },
            creditsDeducted: creditsUsed
          });
          return;
        }

      } catch (cmsError) {
        console.error('[AI Chat] CMS management error:', cmsError);
        return res.json({
          success: true,
          message: `Couldn't manage CMS content: ${cmsError.message}`,
          creditsDeducted: creditsUsed
        });
      }

    } else {
      // Just chat - provide context about our slot-based system
      const hasImages = images && images.length > 0;
      const chatSystemPrompt = `You are the AI assistant for DainoStore, a visual e-commerce website builder.

IMPORTANT: DainoStore uses a SLOT-BASED CONFIGURATION SYSTEM, not raw HTML/CSS.
- Pages are built from configurable slots (components)
- Each slot has properties: position, styles, className, visibility
- Changes are made by updating slot configurations, NOT by editing HTML files
- Users configure their store visually through the Editor

Available page types: product, category, cart, checkout, homepage, header
Common slots: product_title, product_sku, price_container, product_gallery, add_to_cart_button, stock_status

What you can help with:
- STYLING: "make sku red" → I modify the product_sku slot's color property
- LAYOUT: "move sku above price" → I reorder slots by updating position values
- ANALYTICS: "which product sold most" → I query the database and show results
- SETTINGS: "change breadcrumb color to blue" → I update theme settings
- JOBS: "import products from akeneo" → I trigger background import jobs
- ADMIN: "create 20% discount coupon" → I create/update store entities
- PLUGINS: "add a wishlist button" → I generate custom functionality
- TRANSLATIONS: "translate to French" → I update language strings
${hasImages ? `- IMAGE ANALYSIS: I can analyze uploaded images to extract colors, layouts, and design patterns

When analyzing images:
- Extract brand colors (primary, secondary, accent) with hex codes
- Identify layout patterns and structure
- Describe typography and visual style
- Suggest how to apply similar styling to the store` : ''}

When users ask about styling or layout, ALWAYS explain that you'll modify their slot configuration.
NEVER suggest editing HTML files or CSS stylesheets directly - that's not how DainoStore works.

If users ask data questions (best seller, revenue, customers), tell them you can query the database.
If users ask about settings/appearance, tell them you can update theme settings directly.
${hasImages ? '\nThe user has attached image(s). Analyze them and respond to their question about the image(s).' : ''}

Previous conversation: ${JSON.stringify(conversationHistory?.slice(-3) || [])}`;

      const chatResult = await aiService.generate({
        userId,
        operationType: 'general',
        modelId,
        serviceKey,
        prompt: message,
        systemPrompt: chatSystemPrompt,
        maxTokens: 1024,
        temperature: 0.7,
        metadata: { type: 'chat', storeId: resolvedStoreId, modelId },
        images // Pass images for vision support
      });

      // Save chat response for learning
      aiContextService.saveChatMessage({
        userId,
        storeId: resolvedStoreId,
        sessionId,
        role: 'assistant',
        content: chatResult.content,
        intent: 'chat',
        wasSuccessful: true,
        metadata: { type: 'general_chat' }
      }).catch(err => console.error('Failed to save chat response:', err));

      res.json({
        success: true,
        message: chatResult.content,
        data: null,
        creditsDeducted: creditsUsed + chatResult.creditsDeducted
      });
    }

  } catch (error) {
    console.error('Chat Error:', error);

    if (error.message.includes('Insufficient credits')) {
      return res.status(402).json({
        success: false,
        code: 'INSUFFICIENT_CREDITS',
        message: error.message
      });
    }

    res.status(500).json({
      success: false,
      message: error.message || 'Chat failed'
    });
  }
});

/**
 * POST /api/ai/code/patch
 * Generate code patch
 */
router.post('/code/patch', authMiddleware, async (req, res) => {
  try {
    const { prompt, sourceCode, filePath } = req.body;
    const userId = req.user.id;

    if (!prompt || !sourceCode || !filePath) {
      return res.status(400).json({
        success: false,
        message: 'prompt, sourceCode, and filePath are required'
      });
    }

    const result = await aiService.generateCodePatch(userId, prompt, sourceCode, filePath, {
      filePath
    });

    res.json({
      success: true,
      patch: result.content,
      usage: result.usage,
      creditsDeducted: result.creditsDeducted
    });

  } catch (error) {
    console.error('Code Patch Error:', error);

    if (error.message.includes('Insufficient credits')) {
      return res.status(402).json({
        success: false,
        code: 'INSUFFICIENT_CREDITS',
        message: error.message
      });
    }

    res.status(500).json({
      success: false,
      message: error.message || 'Code patch generation failed'
    });
  }
});

// ============================================
// CHAT HISTORY ENDPOINTS
// ============================================

/**
 * GET /api/ai/chat/history
 * Get chat history for current user
 */
router.get('/chat/history', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const storeId = req.headers['x-store-id'] || req.query.store_id;
    const limit = parseInt(req.query.limit) || 50;
    const sessionId = req.query.session_id;

    if (!storeId) {
      return res.status(400).json({ success: false, message: 'store_id is required' });
    }

    const ConnectionManager = require('../services/database/ConnectionManager');
    const tenantDb = await ConnectionManager.getStoreConnection(storeId);

    let query = tenantDb
      .from('ai_chat_sessions')
      .select('id, role, content, intent, data, credits_used, is_error, created_at')
      .eq('user_id', userId)
      .eq('visible', true)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (sessionId) {
      query = query.eq('session_id', sessionId);
    }

    const { data: messages, error } = await query;

    if (error) {
      console.error('[AI Chat History] Error fetching:', error);
      return res.json({ success: true, messages: [] });
    }

    // Reverse to show oldest first
    res.json({
      success: true,
      messages: (messages || []).reverse()
    });
  } catch (error) {
    console.error('[AI Chat History] Error:', error);
    res.json({ success: true, messages: [] });
  }
});

/**
 * POST /api/ai/chat/history
 * Save a chat message to history
 */
router.post('/chat/history', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const storeId = req.headers['x-store-id'] || req.body.storeId;
    const { sessionId, role, content, intent, data, creditsUsed, isError } = req.body;

    if (!storeId || !role || !content) {
      return res.status(400).json({ success: false, message: 'storeId, role, and content are required' });
    }

    const ConnectionManager = require('../services/database/ConnectionManager');
    const tenantDb = await ConnectionManager.getStoreConnection(storeId);

    const { error } = await tenantDb
      .from('ai_chat_sessions')
      .insert({
        user_id: userId,
        session_id: sessionId || `session_${Date.now()}`,
        role,
        content,
        intent: intent || null,
        data: data || {},
        credits_used: Math.round(creditsUsed || 0),
        is_error: isError || false,
        created_at: new Date().toISOString()
      });

    if (error) {
      console.error('[AI Chat History] Error saving:', error);
    }

    res.json({ success: true });
  } catch (error) {
    console.error('[AI Chat History] Error:', error);
    res.json({ success: true }); // Don't fail the main flow
  }
});

/**
 * DELETE /api/ai/chat/history
 * Clear chat history by setting visible = false (soft delete)
 */
router.delete('/chat/history', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const storeId = req.headers['x-store-id'] || req.query.store_id;

    if (!storeId) {
      return res.status(400).json({ success: false, message: 'store_id is required' });
    }

    const ConnectionManager = require('../services/database/ConnectionManager');
    const tenantDb = await ConnectionManager.getStoreConnection(storeId);

    const { error } = await tenantDb
      .from('ai_chat_sessions')
      .update({ visible: false })
      .eq('user_id', userId)
      .eq('visible', true);

    if (error) {
      console.error('[AI Chat History] Error clearing:', error);
      return res.status(500).json({ success: false, message: 'Failed to clear chat history' });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('[AI Chat History] Error:', error);
    res.status(500).json({ success: false, message: 'Failed to clear chat history' });
  }
});

/**
 * GET /api/ai/chat/input-history
 * Get input history for arrow up/down navigation (from ai_chat_sessions user messages)
 */
router.get('/chat/input-history', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const storeId = req.headers['x-store-id'] || req.query.store_id;
    const limit = parseInt(req.query.limit) || 20;

    if (!storeId) {
      return res.status(400).json({ success: false, message: 'store_id is required' });
    }

    const ConnectionManager = require('../services/database/ConnectionManager');
    const tenantDb = await ConnectionManager.getStoreConnection(storeId);

    // Get user messages from chat_sessions (single table approach)
    const { data: inputs, error } = await tenantDb
      .from('ai_chat_sessions')
      .select('content, created_at')
      .eq('user_id', userId)
      .eq('role', 'user')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('[AI Input History] Error:', error);
      return res.json({ success: true, inputs: [] });
    }

    res.json({
      success: true,
      inputs: (inputs || []).map(i => i.content)
    });
  } catch (error) {
    console.error('[AI Input History] Error:', error);
    res.json({ success: true, inputs: [] });
  }
});

/**
 * POST /api/ai/chat/input-history
 * DEPRECATED: Input history is now derived from ai_chat_sessions user messages
 * Kept for backwards compatibility - does nothing
 */
router.post('/chat/input-history', authMiddleware, async (req, res) => {
  // Input history is now stored via /chat/history endpoint
  // This endpoint exists only for backwards compatibility
  res.json({ success: true });
});

module.exports = router;
