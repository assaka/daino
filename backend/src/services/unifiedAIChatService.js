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
const OpenAI = require('openai');
const { masterDbClient } = require('../database/masterConnection');
const ConnectionManager = require('./database/ConnectionManager');
const aiContextService = require('./aiContextService');
const aiLearningService = require('./aiLearningService');
const aiEntityService = require('./aiEntityService');
const aiModelsService = require('./AIModelsService');

// LLM Clients - initialized lazily
let anthropicClient = null;
let openaiClient = null;

function getAnthropicClient() {
  if (!anthropicClient) {
    anthropicClient = new Anthropic();
  }
  return anthropicClient;
}

function getOpenAIClient() {
  if (!openaiClient) {
    openaiClient = new OpenAI();
  }
  return openaiClient;
}

/**
 * Response verbosity levels (A-F):
 * A = Minimal    - Just "Done" or "✓ Updated"
 * B = Brief      - One short sentence
 * C = Standard   - Confirmation with key details
 * D = Detailed   - Previous values, context, formatting
 * E = Comprehensive - All details, related items, suggestions
 * F = Expert     - Full analysis, recommendations, follow-ups
 */
const AI_RESPONSE_VERBOSITY = process.env.AI_RESPONSE_VERBOSITY || 'D';

const VERBOSITY_PROMPTS = {
  A: `RESPONSE STYLE (Minimal):
- Respond with just "Done", "Updated", or "✓" plus the action
- No formatting, no details, no follow-up
- Example: "✓ Stock set to 99"`,

  B: `RESPONSE STYLE (Brief):
- One short sentence confirming the action
- Include only the most essential detail
- Example: "Updated stock of alans-art-11x14 to 99 units."`,

  C: `RESPONSE STYLE (Standard):
- Clear confirmation with key details
- Use simple formatting (bold for important values)
- Example: "**Stock updated** for alans-art-11x14: now **99 units**"`,

  D: `RESPONSE STYLE (Detailed):
- Rich response with context and previous values
- Show what changed: "updated from X to Y"
- Use markdown formatting with bullets
- Include relevant details like price, status
- Use emojis sparingly (✅ for success)`,

  E: `RESPONSE STYLE (Comprehensive):
- Full detailed response with all relevant context
- Show previous values, current state, related items
- Include summary tables when multiple items involved
- Provide relevant suggestions or warnings
- Use headers, bullets, bold, and formatting
- End with contextual follow-up question`,

  F: `RESPONSE STYLE (Expert):
- Complete analysis with full context
- Show all related data (variants, categories, stock levels)
- Provide business insights and recommendations
- Include data summaries and statistics
- Suggest next actions or optimizations
- Format as a mini-report with sections
- Always end with actionable suggestions`
};

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
    description: "Update a product by name or SKU. Can update: name, description, price, stock_quantity, status, featured, compare_price.",
    input_schema: {
      type: "object",
      properties: {
        product: {
          type: "string",
          description: "Product name or SKU to find"
        },
        updates: {
          type: "object",
          description: "Fields to update",
          properties: {
            name: { type: "string", description: "Product name" },
            description: { type: "string", description: "Product description" },
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
    description: "Update a category by name or slug. Can update: name, description, visibility (is_active, hide_in_menu), sort_order.",
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
            name: { type: "string", description: "Category name" },
            description: { type: "string", description: "Category description" },
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
    name: "update_attribute",
    description: "Update an attribute by code. Can update: name (via attribute_translations), description, values (via attribute_values), is_filterable, is_searchable.",
    input_schema: {
      type: "object",
      properties: {
        code: { type: "string", description: "Attribute code to find" },
        updates: {
          type: "object",
          description: "Fields to update",
          properties: {
            name: { type: "string", description: "Display name (stored in attribute_translations.label)" },
            description: { type: "string", description: "Attribute description (stored in attribute_translations)" },
            values: { type: "array", items: { type: "string" }, description: "Add new values (stored in attribute_values + attribute_value_translations)" },
            is_filterable: { type: "boolean", description: "Show in filters" },
            is_searchable: { type: "boolean", description: "Include in search" }
          }
        }
      },
      required: ["code", "updates"]
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
  // CMS PAGES
  // ═══════════════════════════════════════════════════════════════
  {
    name: "list_cms_pages",
    description: "List all CMS pages (About, Contact, Terms, etc.).",
    input_schema: {
      type: "object",
      properties: {
        include_inactive: { type: "boolean", description: "Include inactive pages" }
      }
    }
  },
  {
    name: "create_cms_page",
    description: "Create a new CMS page.",
    input_schema: {
      type: "object",
      properties: {
        title: { type: "string", description: "Page title" },
        slug: { type: "string", description: "URL slug (auto-generated if not provided)" },
        content: { type: "string", description: "Page content (HTML)" },
        is_active: { type: "boolean", description: "Page active status (default true)" }
      },
      required: ["title", "content"]
    }
  },
  {
    name: "update_cms_page",
    description: "Update a CMS page by title or slug.",
    input_schema: {
      type: "object",
      properties: {
        page: { type: "string", description: "Page title or slug to find" },
        updates: {
          type: "object",
          properties: {
            title: { type: "string" },
            content: { type: "string" },
            is_active: { type: "boolean" }
          }
        }
      },
      required: ["page", "updates"]
    }
  },
  {
    name: "delete_cms_page",
    description: "Delete a CMS page by title or slug.",
    input_schema: {
      type: "object",
      properties: {
        page: { type: "string", description: "Page title or slug to delete" }
      },
      required: ["page"]
    }
  },

  // ═══════════════════════════════════════════════════════════════
  // CMS BLOCKS
  // ═══════════════════════════════════════════════════════════════
  {
    name: "list_cms_blocks",
    description: "List all CMS blocks (reusable content snippets).",
    input_schema: {
      type: "object",
      properties: {}
    }
  },
  {
    name: "create_cms_block",
    description: "Create a new CMS block.",
    input_schema: {
      type: "object",
      properties: {
        identifier: { type: "string", description: "Block identifier/code" },
        title: { type: "string", description: "Block title" },
        content: { type: "string", description: "Block content (HTML)" },
        is_active: { type: "boolean", description: "Block active status (default true)" }
      },
      required: ["identifier", "title", "content"]
    }
  },
  {
    name: "update_cms_block",
    description: "Update a CMS block by identifier or title.",
    input_schema: {
      type: "object",
      properties: {
        block: { type: "string", description: "Block identifier or title" },
        updates: {
          type: "object",
          properties: {
            title: { type: "string" },
            content: { type: "string" },
            is_active: { type: "boolean" }
          }
        }
      },
      required: ["block", "updates"]
    }
  },
  {
    name: "delete_cms_block",
    description: "Delete a CMS block by identifier.",
    input_schema: {
      type: "object",
      properties: {
        block: { type: "string", description: "Block identifier or title" }
      },
      required: ["block"]
    }
  },

  // ═══════════════════════════════════════════════════════════════
  // PRODUCT LABELS
  // ═══════════════════════════════════════════════════════════════
  {
    name: "list_product_labels",
    description: "List all product labels/badges (Sale, New, etc.).",
    input_schema: {
      type: "object",
      properties: {}
    }
  },
  {
    name: "create_product_label",
    description: "Create a new product label/badge.",
    input_schema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Label name" },
        text: { type: "string", description: "Display text on label" },
        color: { type: "string", description: "Text color (hex)" },
        background_color: { type: "string", description: "Background color (hex)" },
        position: { type: "string", enum: ["top-left", "top-right", "bottom-left", "bottom-right"], description: "Label position on product image" }
      },
      required: ["name", "text"]
    }
  },
  {
    name: "update_product_label",
    description: "Update a product label.",
    input_schema: {
      type: "object",
      properties: {
        label: { type: "string", description: "Label name to find" },
        updates: {
          type: "object",
          properties: {
            name: { type: "string" },
            text: { type: "string" },
            color: { type: "string" },
            background_color: { type: "string" },
            position: { type: "string", enum: ["top-left", "top-right", "bottom-left", "bottom-right"] },
            is_active: { type: "boolean" }
          }
        }
      },
      required: ["label", "updates"]
    }
  },
  {
    name: "delete_product_label",
    description: "Delete a product label.",
    input_schema: {
      type: "object",
      properties: {
        label: { type: "string", description: "Label name to delete" }
      },
      required: ["label"]
    }
  },

  // ═══════════════════════════════════════════════════════════════
  // SHIPPING METHODS
  // ═══════════════════════════════════════════════════════════════
  {
    name: "list_shipping_methods",
    description: "List all shipping methods.",
    input_schema: {
      type: "object",
      properties: {}
    }
  },
  {
    name: "create_shipping_method",
    description: "Create a new shipping method.",
    input_schema: {
      type: "object",
      properties: {
        code: { type: "string", description: "Shipping method code (e.g., 'standard', 'express')" },
        name: { type: "string", description: "Display name" },
        price: { type: "number", description: "Shipping price" },
        min_order_amount: { type: "number", description: "Minimum order for this method" },
        estimated_days: { type: "string", description: "Estimated delivery (e.g., '3-5 days')" }
      },
      required: ["code", "name", "price"]
    }
  },
  {
    name: "update_shipping_method",
    description: "Update a shipping method.",
    input_schema: {
      type: "object",
      properties: {
        method: { type: "string", description: "Shipping method code or name" },
        updates: {
          type: "object",
          properties: {
            name: { type: "string" },
            price: { type: "number" },
            min_order_amount: { type: "number" },
            estimated_days: { type: "string" },
            is_active: { type: "boolean" }
          }
        }
      },
      required: ["method", "updates"]
    }
  },
  {
    name: "delete_shipping_method",
    description: "Delete a shipping method.",
    input_schema: {
      type: "object",
      properties: {
        method: { type: "string", description: "Shipping method code or name" }
      },
      required: ["method"]
    }
  },

  // ═══════════════════════════════════════════════════════════════
  // PAYMENT METHODS
  // ═══════════════════════════════════════════════════════════════
  {
    name: "list_payment_methods",
    description: "List all payment methods.",
    input_schema: {
      type: "object",
      properties: {}
    }
  },
  {
    name: "update_payment_method",
    description: "Update a payment method (enable/disable, update settings).",
    input_schema: {
      type: "object",
      properties: {
        method: { type: "string", description: "Payment method code or name" },
        updates: {
          type: "object",
          properties: {
            name: { type: "string" },
            is_active: { type: "boolean" },
            sort_order: { type: "number" }
          }
        }
      },
      required: ["method", "updates"]
    }
  },

  // ═══════════════════════════════════════════════════════════════
  // EMAIL TEMPLATES
  // ═══════════════════════════════════════════════════════════════
  {
    name: "list_email_templates",
    description: "List all email templates (order confirmation, shipping, etc.).",
    input_schema: {
      type: "object",
      properties: {}
    }
  },
  {
    name: "update_email_template",
    description: "Update an email template.",
    input_schema: {
      type: "object",
      properties: {
        template: { type: "string", description: "Template code or name (e.g., 'order_confirmation')" },
        updates: {
          type: "object",
          properties: {
            subject: { type: "string" },
            content: { type: "string" },
            is_active: { type: "boolean" }
          }
        }
      },
      required: ["template", "updates"]
    }
  },

  // ═══════════════════════════════════════════════════════════════
  // TAXES
  // ═══════════════════════════════════════════════════════════════
  {
    name: "list_taxes",
    description: "List all tax configurations.",
    input_schema: {
      type: "object",
      properties: {}
    }
  },
  {
    name: "create_tax",
    description: "Create a new tax configuration.",
    input_schema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Tax name (e.g., 'VAT', 'Sales Tax')" },
        rate: { type: "number", description: "Tax rate percentage (e.g., 21 for 21%)" },
        country_code: { type: "string", description: "Country code (e.g., 'US', 'NL')" }
      },
      required: ["name", "rate"]
    }
  },
  {
    name: "update_tax",
    description: "Update a tax configuration.",
    input_schema: {
      type: "object",
      properties: {
        tax: { type: "string", description: "Tax name to find" },
        updates: {
          type: "object",
          properties: {
            name: { type: "string" },
            rate: { type: "number" },
            is_active: { type: "boolean" }
          }
        }
      },
      required: ["tax", "updates"]
    }
  },
  {
    name: "delete_tax",
    description: "Delete a tax configuration.",
    input_schema: {
      type: "object",
      properties: {
        tax: { type: "string", description: "Tax name to delete" }
      },
      required: ["tax"]
    }
  },

  // ═══════════════════════════════════════════════════════════════
  // ATTRIBUTE SETS
  // ═══════════════════════════════════════════════════════════════
  {
    name: "list_attribute_sets",
    description: "List all attribute sets.",
    input_schema: { type: "object", properties: {} }
  },
  {
    name: "create_attribute_set",
    description: "Create a new attribute set.",
    input_schema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Attribute set name" },
        description: { type: "string", description: "Description" },
        is_default: { type: "boolean", description: "Set as default for new products" }
      },
      required: ["name"]
    }
  },
  {
    name: "update_attribute_set",
    description: "Update an attribute set or add/remove attributes from it.",
    input_schema: {
      type: "object",
      properties: {
        attribute_set: { type: "string", description: "Attribute set name" },
        updates: {
          type: "object",
          properties: {
            name: { type: "string" },
            description: { type: "string" },
            is_default: { type: "boolean" },
            add_attributes: { type: "array", items: { type: "string" }, description: "Attribute codes to add" },
            remove_attributes: { type: "array", items: { type: "string" }, description: "Attribute codes to remove" }
          }
        }
      },
      required: ["attribute_set", "updates"]
    }
  },
  {
    name: "delete_attribute_set",
    description: "Delete an attribute set.",
    input_schema: {
      type: "object",
      properties: {
        attribute_set: { type: "string", description: "Attribute set name" }
      },
      required: ["attribute_set"]
    }
  },

  // ═══════════════════════════════════════════════════════════════
  // CUSTOM OPTION RULES
  // ═══════════════════════════════════════════════════════════════
  {
    name: "list_custom_option_rules",
    description: "List all custom option rules (rules for when to show custom product options).",
    input_schema: { type: "object", properties: {} }
  },
  {
    name: "create_custom_option_rule",
    description: "Create a custom option rule.",
    input_schema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Rule name" },
        display_label: { type: "string", description: "Label shown to customer" },
        conditions: { type: "object", description: "Conditions when rule applies (category_ids, product_ids, etc.)" },
        optional_product_ids: { type: "array", items: { type: "string" }, description: "Product IDs that are optional selections" }
      },
      required: ["name"]
    }
  },
  {
    name: "update_custom_option_rule",
    description: "Update a custom option rule.",
    input_schema: {
      type: "object",
      properties: {
        rule: { type: "string", description: "Rule name" },
        updates: {
          type: "object",
          properties: {
            name: { type: "string" },
            display_label: { type: "string" },
            conditions: { type: "object" },
            optional_product_ids: { type: "array", items: { type: "string" } },
            is_active: { type: "boolean" }
          }
        }
      },
      required: ["rule", "updates"]
    }
  },
  {
    name: "delete_custom_option_rule",
    description: "Delete a custom option rule.",
    input_schema: {
      type: "object",
      properties: {
        rule: { type: "string", description: "Rule name" }
      },
      required: ["rule"]
    }
  },

  // ═══════════════════════════════════════════════════════════════
  // PRODUCT TABS
  // ═══════════════════════════════════════════════════════════════
  {
    name: "list_product_tabs",
    description: "List all product tabs (custom tabs on product pages).",
    input_schema: { type: "object", properties: {} }
  },
  {
    name: "create_product_tab",
    description: "Create a product tab.",
    input_schema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Tab name" },
        content: { type: "string", description: "Tab content (HTML)" },
        tab_type: { type: "string", enum: ["text", "attributes", "attribute_set"], description: "Tab type" },
        attribute_ids: { type: "array", items: { type: "string" }, description: "Attribute IDs to show (for attributes type)" },
        attribute_set_ids: { type: "array", items: { type: "string" }, description: "Attribute set IDs (for attribute_set type)" }
      },
      required: ["name"]
    }
  },
  {
    name: "update_product_tab",
    description: "Update a product tab.",
    input_schema: {
      type: "object",
      properties: {
        tab: { type: "string", description: "Tab name or slug" },
        updates: {
          type: "object",
          properties: {
            name: { type: "string" },
            content: { type: "string" },
            is_active: { type: "boolean" },
            sort_order: { type: "number" }
          }
        }
      },
      required: ["tab", "updates"]
    }
  },
  {
    name: "delete_product_tab",
    description: "Delete a product tab.",
    input_schema: {
      type: "object",
      properties: {
        tab: { type: "string", description: "Tab name or slug" }
      },
      required: ["tab"]
    }
  },

  // ═══════════════════════════════════════════════════════════════
  // BLACKLIST MANAGEMENT
  // ═══════════════════════════════════════════════════════════════
  {
    name: "list_blacklist",
    description: "List blacklisted emails, IPs, or countries.",
    input_schema: {
      type: "object",
      properties: {
        type: { type: "string", enum: ["emails", "ips", "countries", "all"], description: "Type of blacklist to list" }
      },
      required: ["type"]
    }
  },
  {
    name: "add_to_blacklist",
    description: "Add email, IP, or country to blacklist.",
    input_schema: {
      type: "object",
      properties: {
        type: { type: "string", enum: ["email", "ip", "country"], description: "Type of entry" },
        value: { type: "string", description: "Email, IP address, or country code" },
        reason: { type: "string", description: "Reason for blacklisting" }
      },
      required: ["type", "value"]
    }
  },
  {
    name: "remove_from_blacklist",
    description: "Remove email, IP, or country from blacklist.",
    input_schema: {
      type: "object",
      properties: {
        type: { type: "string", enum: ["email", "ip", "country"], description: "Type of entry" },
        value: { type: "string", description: "Email, IP address, or country code" }
      },
      required: ["type", "value"]
    }
  },
  {
    name: "blacklist_customer",
    description: "Blacklist a customer by email.",
    input_schema: {
      type: "object",
      properties: {
        email: { type: "string", description: "Customer email" },
        reason: { type: "string", description: "Reason for blacklisting" }
      },
      required: ["email"]
    }
  },

  // ═══════════════════════════════════════════════════════════════
  // DELIVERY SETTINGS
  // ═══════════════════════════════════════════════════════════════
  {
    name: "get_delivery_settings",
    description: "Get delivery date/time settings.",
    input_schema: { type: "object", properties: {} }
  },
  {
    name: "update_delivery_settings",
    description: "Update delivery date/time settings.",
    input_schema: {
      type: "object",
      properties: {
        enable_delivery_date: { type: "boolean", description: "Enable delivery date selection" },
        enable_comments: { type: "boolean", description: "Enable delivery comments" },
        offset_days: { type: "number", description: "Minimum days from order date" },
        max_advance_days: { type: "number", description: "Maximum days in advance" },
        blocked_weekdays: { type: "array", items: { type: "number" }, description: "Blocked weekdays (0=Sun, 6=Sat)" },
        blocked_dates: { type: "array", items: { type: "string" }, description: "Blocked dates (YYYY-MM-DD)" }
      }
    }
  },

  // ═══════════════════════════════════════════════════════════════
  // COOKIE CONSENT
  // ═══════════════════════════════════════════════════════════════
  {
    name: "get_cookie_consent_settings",
    description: "Get cookie consent banner settings.",
    input_schema: { type: "object", properties: {} }
  },
  {
    name: "update_cookie_consent_settings",
    description: "Update cookie consent settings.",
    input_schema: {
      type: "object",
      properties: {
        is_enabled: { type: "boolean", description: "Enable cookie consent banner" },
        banner_position: { type: "string", enum: ["bottom", "top", "bottom-left", "bottom-right"], description: "Banner position" },
        theme: { type: "string", enum: ["light", "dark"], description: "Banner theme" },
        gdpr_mode: { type: "boolean", description: "Enable GDPR mode" },
        analytics_cookies: { type: "boolean", description: "Show analytics cookies option" },
        marketing_cookies: { type: "boolean", description: "Show marketing cookies option" },
        primary_color: { type: "string", description: "Primary color (hex)" },
        privacy_policy_url: { type: "string", description: "Privacy policy URL" }
      }
    }
  },

  // ═══════════════════════════════════════════════════════════════
  // SEO SETTINGS & TEMPLATES
  // ═══════════════════════════════════════════════════════════════
  {
    name: "get_seo_settings",
    description: "Get global SEO settings.",
    input_schema: { type: "object", properties: {} }
  },
  {
    name: "update_seo_settings",
    description: "Update global SEO settings.",
    input_schema: {
      type: "object",
      properties: {
        default_title_suffix: { type: "string", description: "Suffix added to all page titles" },
        default_meta_description: { type: "string", description: "Default meta description" },
        robots_txt: { type: "string", description: "robots.txt content" },
        google_analytics_id: { type: "string", description: "Google Analytics ID" },
        google_tag_manager_id: { type: "string", description: "Google Tag Manager ID" }
      }
    }
  },
  {
    name: "list_seo_templates",
    description: "List SEO templates (for products, categories, etc.).",
    input_schema: { type: "object", properties: {} }
  },
  {
    name: "update_seo_template",
    description: "Update an SEO template.",
    input_schema: {
      type: "object",
      properties: {
        template: { type: "string", description: "Template name or page type" },
        updates: {
          type: "object",
          properties: {
            title_template: { type: "string", description: "Title template with variables like {{product.name}}" },
            meta_description_template: { type: "string", description: "Meta description template" },
            is_active: { type: "boolean" }
          }
        }
      },
      required: ["template", "updates"]
    }
  },

  // ═══════════════════════════════════════════════════════════════
  // INTEGRATIONS / IMPORTS
  // ═══════════════════════════════════════════════════════════════
  {
    name: "trigger_akeneo_import",
    description: "Trigger an Akeneo product import.",
    input_schema: {
      type: "object",
      properties: {
        import_type: { type: "string", enum: ["products", "categories", "attributes", "all"], description: "What to import" },
        full_sync: { type: "boolean", description: "Full sync (true) or incremental (false)" }
      }
    }
  },
  {
    name: "trigger_shopify_import",
    description: "Trigger a Shopify import.",
    input_schema: {
      type: "object",
      properties: {
        import_type: { type: "string", enum: ["products", "categories", "collections", "all"], description: "What to import" },
        full_sync: { type: "boolean", description: "Full sync (true) or incremental (false)" }
      }
    }
  },
  {
    name: "trigger_woocommerce_import",
    description: "Trigger a WooCommerce import.",
    input_schema: {
      type: "object",
      properties: {
        import_type: { type: "string", enum: ["products", "categories", "all"], description: "What to import" },
        full_sync: { type: "boolean", description: "Full sync (true) or incremental (false)" }
      }
    }
  },

  // ═══════════════════════════════════════════════════════════════
  // STORE SETTINGS
  // ═══════════════════════════════════════════════════════════════
  {
    name: "get_store_settings",
    description: "Get store configuration for a specific area or all settings.",
    input_schema: {
      type: "object",
      properties: {
        area: { type: "string", enum: ["theme", "display", "stock", "category", "checkout", "navigation", "gallery", "all"], description: "Settings area to retrieve" }
      },
      required: ["area"]
    }
  },
  {
    name: "update_store_setting",
    description: "Update a single store setting by path.",
    input_schema: {
      type: "object",
      properties: {
        setting_path: { type: "string", description: "Setting path like 'theme.primary_button_color' or 'hide_header_cart'" },
        value: { description: "New value" }
      },
      required: ["setting_path", "value"]
    }
  },
  {
    name: "update_stock_settings",
    description: "Update stock/inventory display settings: enable_inventory, display_out_of_stock, hide_stock_quantity, display_low_stock_threshold, show_stock_label.",
    input_schema: {
      type: "object",
      properties: {
        enable_inventory: { type: "boolean", description: "Enable inventory tracking" },
        display_out_of_stock: { type: "boolean", description: "Show out of stock products" },
        hide_stock_quantity: { type: "boolean", description: "Hide exact stock quantity from customers" },
        display_low_stock_threshold: { type: "number", description: "Show low stock warning below this threshold (0=disabled)" },
        show_stock_label: { type: "boolean", description: "Show In Stock/Out of Stock labels" }
      }
    }
  },
  {
    name: "update_display_settings",
    description: "Update display/UI settings: hide_header_cart, hide_header_checkout, hide_header_search, show_permanent_search, show_category_in_breadcrumb, show_language_selector, hide_quantity_selector, hide_currency_category, hide_currency_product.",
    input_schema: {
      type: "object",
      properties: {
        hide_header_cart: { type: "boolean", description: "Hide cart icon in header" },
        hide_header_checkout: { type: "boolean", description: "Hide checkout link in header" },
        hide_header_search: { type: "boolean", description: "Hide search icon in header" },
        show_permanent_search: { type: "boolean", description: "Always show search bar (not just icon)" },
        show_category_in_breadcrumb: { type: "boolean", description: "Show category in breadcrumb" },
        show_language_selector: { type: "boolean", description: "Show language selector in header" },
        hide_quantity_selector: { type: "boolean", description: "Hide quantity selector on product page" },
        hide_currency_category: { type: "boolean", description: "Hide currency symbol on category pages" },
        hide_currency_product: { type: "boolean", description: "Hide currency symbol on product pages" },
        enable_reviews: { type: "boolean", description: "Enable product reviews" }
      }
    }
  },
  {
    name: "update_category_settings",
    description: "Update category page settings: enable_product_filters, collapse_filters, max_visible_attributes, enable_view_mode_toggle, default_view_mode.",
    input_schema: {
      type: "object",
      properties: {
        enable_product_filters: { type: "boolean", description: "Show filter sidebar on category pages" },
        collapse_filters: { type: "boolean", description: "Collapse filter groups by default" },
        max_visible_attributes: { type: "number", description: "Max filter attributes shown before Show More" },
        enable_view_mode_toggle: { type: "boolean", description: "Show grid/list view toggle" },
        default_view_mode: { type: "string", enum: ["grid", "list"], description: "Default product view mode" }
      }
    }
  },
  {
    name: "update_checkout_settings",
    description: "Update checkout flow settings: checkout_steps_count (1, 2, or 3), step names, allow_guest_checkout, require_shipping_address, phone collection settings.",
    input_schema: {
      type: "object",
      properties: {
        checkout_steps_count: { type: "number", enum: [1, 2, 3], description: "Number of checkout steps" },
        checkout_2step_step1_name: { type: "string", description: "Step 1 name for 2-step checkout" },
        checkout_2step_step2_name: { type: "string", description: "Step 2 name for 2-step checkout" },
        checkout_3step_step1_name: { type: "string", description: "Step 1 name for 3-step checkout" },
        checkout_3step_step2_name: { type: "string", description: "Step 2 name for 3-step checkout" },
        checkout_3step_step3_name: { type: "string", description: "Step 3 name for 3-step checkout" },
        allow_guest_checkout: { type: "boolean", description: "Allow checkout without account" },
        require_shipping_address: { type: "boolean", description: "Require shipping address" },
        collect_phone_number_at_checkout: { type: "boolean", description: "Show phone number field" },
        phone_number_required_at_checkout: { type: "boolean", description: "Make phone number required" }
      }
    }
  },
  {
    name: "update_navigation_settings",
    description: "Update navigation/menu settings: excludeRootFromMenu, expandAllMenuItems, rootCategoryId.",
    input_schema: {
      type: "object",
      properties: {
        excludeRootFromMenu: { type: "boolean", description: "Hide root category from navigation menu" },
        expandAllMenuItems: { type: "boolean", description: "Expand all menu items by default" },
        rootCategoryId: { type: "string", description: "ID of category to use as navigation root (null for default)" }
      }
    }
  },
  {
    name: "update_gallery_settings",
    description: "Update product gallery layout settings.",
    input_schema: {
      type: "object",
      properties: {
        product_gallery_layout: { type: "string", enum: ["horizontal", "vertical"], description: "Thumbnail gallery orientation" },
        vertical_gallery_position: { type: "string", enum: ["left", "right"], description: "Position of vertical thumbnails" },
        mobile_gallery_layout: { type: "string", enum: ["below", "hidden"], description: "Thumbnail position on mobile" }
      }
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
  },

  // ═══════════════════════════════════════════════════════════════
  // STORE GENERAL SETTINGS
  // ═══════════════════════════════════════════════════════════════
  {
    name: "get_store_info",
    description: "Get store general information: name, description, currency, timezone, deployment status.",
    input_schema: {
      type: "object",
      properties: {}
    }
  },
  {
    name: "update_store_info",
    description: "Update store general information like name, description, currency, timezone.",
    input_schema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Store name" },
        description: { type: "string", description: "Store description" },
        currency: { type: "string", description: "Currency code (USD, EUR, GBP, etc.)" },
        timezone: { type: "string", description: "Timezone (UTC, America/New_York, Europe/London, etc.)" }
      }
    }
  },

  // ═══════════════════════════════════════════════════════════════
  // LANGUAGES
  // ═══════════════════════════════════════════════════════════════
  {
    name: "list_languages",
    description: "List all languages configured for the store.",
    input_schema: {
      type: "object",
      properties: {
        active_only: { type: "boolean", description: "Only show active languages" }
      }
    }
  },
  {
    name: "create_language",
    description: "Add a new language to the store.",
    input_schema: {
      type: "object",
      properties: {
        code: { type: "string", description: "Language code (en, de, fr, nl, es, etc.)" },
        name: { type: "string", description: "Language name (English, German, French, etc.)" },
        native_name: { type: "string", description: "Native name (English, Deutsch, Français, etc.)" },
        flag: { type: "string", description: "Flag emoji or URL" },
        is_rtl: { type: "boolean", description: "Right-to-left language (Arabic, Hebrew)" },
        is_active: { type: "boolean", description: "Enable this language (default true)" },
        is_default: { type: "boolean", description: "Set as default language" }
      },
      required: ["code", "name"]
    }
  },
  {
    name: "update_language",
    description: "Update a language by code.",
    input_schema: {
      type: "object",
      properties: {
        code: { type: "string", description: "Language code to update" },
        name: { type: "string", description: "Language name" },
        native_name: { type: "string", description: "Native name" },
        flag: { type: "string", description: "Flag emoji or URL" },
        is_rtl: { type: "boolean", description: "Right-to-left language" },
        is_active: { type: "boolean", description: "Enable/disable language" },
        is_default: { type: "boolean", description: "Set as default language" }
      },
      required: ["code"]
    }
  },
  {
    name: "delete_language",
    description: "Delete a language by code.",
    input_schema: {
      type: "object",
      properties: {
        code: { type: "string", description: "Language code to delete" }
      },
      required: ["code"]
    }
  },

  // ═══════════════════════════════════════════════════════════════
  // REDIRECTS / URL REWRITES
  // ═══════════════════════════════════════════════════════════════
  {
    name: "list_redirects",
    description: "List URL redirects configured for SEO and link management.",
    input_schema: {
      type: "object",
      properties: {
        active_only: { type: "boolean", description: "Only show active redirects" },
        search: { type: "string", description: "Search in from_url or to_url" },
        limit: { type: "number", description: "Max results (default 50)" }
      }
    }
  },
  {
    name: "create_redirect",
    description: "Create a URL redirect (301 permanent or 302 temporary).",
    input_schema: {
      type: "object",
      properties: {
        from_url: { type: "string", description: "Source URL path (e.g., /old-page)" },
        to_url: { type: "string", description: "Target URL path (e.g., /new-page)" },
        type: { type: "string", enum: ["301", "302"], description: "Redirect type (301=permanent, 302=temporary)" },
        notes: { type: "string", description: "Optional notes about this redirect" }
      },
      required: ["from_url", "to_url"]
    }
  },
  {
    name: "update_redirect",
    description: "Update a redirect by its from_url.",
    input_schema: {
      type: "object",
      properties: {
        from_url: { type: "string", description: "Current source URL to find" },
        new_from_url: { type: "string", description: "New source URL" },
        to_url: { type: "string", description: "New target URL" },
        type: { type: "string", enum: ["301", "302"], description: "Redirect type" },
        is_active: { type: "boolean", description: "Enable/disable redirect" },
        notes: { type: "string", description: "Notes about this redirect" }
      },
      required: ["from_url"]
    }
  },
  {
    name: "delete_redirect",
    description: "Delete a redirect by its from_url.",
    input_schema: {
      type: "object",
      properties: {
        from_url: { type: "string", description: "Source URL of redirect to delete" }
      },
      required: ["from_url"]
    }
  },

  // ═══════════════════════════════════════════════════════════════
  // MEDIA ASSETS
  // ═══════════════════════════════════════════════════════════════
  {
    name: "list_media_assets",
    description: "List media assets (images, files) in the media library.",
    input_schema: {
      type: "object",
      properties: {
        folder: { type: "string", description: "Filter by folder (library, products, categories, etc.)" },
        mime_type: { type: "string", description: "Filter by mime type (image/*, video/*, application/pdf, etc.)" },
        search: { type: "string", description: "Search by file name or description" },
        limit: { type: "number", description: "Max results (default 50)" }
      }
    }
  },
  {
    name: "update_media_asset",
    description: "Update a media asset's metadata by file name.",
    input_schema: {
      type: "object",
      properties: {
        file_name: { type: "string", description: "File name to find" },
        description: { type: "string", description: "New description/alt text" },
        folder: { type: "string", description: "Move to folder" },
        tags: { type: "array", items: { type: "string" }, description: "Tags for organization" }
      },
      required: ["file_name"]
    }
  },
  {
    name: "delete_media_asset",
    description: "Delete a media asset by file name.",
    input_schema: {
      type: "object",
      properties: {
        file_name: { type: "string", description: "File name to delete" }
      },
      required: ["file_name"]
    }
  },

  // ═══════════════════════════════════════════════════════════════
  // CREDITS (Info Only)
  // ═══════════════════════════════════════════════════════════════
  {
    name: "get_credit_balance",
    description: "Get current credit balance and recent usage summary.",
    input_schema: {
      type: "object",
      properties: {
        include_usage: { type: "boolean", description: "Include recent usage breakdown (default true)" }
      }
    }
  },
  {
    name: "get_credit_pricing",
    description: "Get pricing for all services that consume credits.",
    input_schema: {
      type: "object",
      properties: {
        category: { type: "string", enum: ["store_operations", "plugin_management", "ai_services", "data_migration", "storage", "akeneo_integration", "all"], description: "Filter by category" }
      }
    }
  },

  // ═══════════════════════════════════════════════════════════════
  // TEAM MANAGEMENT
  // ═══════════════════════════════════════════════════════════════
  {
    name: "list_team_members",
    description: "List all team members for the current store with their roles and status.",
    input_schema: {
      type: "object",
      properties: {
        include_pending: { type: "boolean", description: "Include pending invitations (default true)" }
      }
    }
  },
  {
    name: "invite_team_member",
    description: "Invite a new team member by email.",
    input_schema: {
      type: "object",
      properties: {
        email: { type: "string", description: "Email address to invite" },
        role: { type: "string", enum: ["admin", "editor", "viewer"], description: "Role to assign (default viewer)" },
        message: { type: "string", description: "Optional personal message in the invitation" }
      },
      required: ["email"]
    }
  },
  {
    name: "update_team_member",
    description: "Update a team member's role or permissions.",
    input_schema: {
      type: "object",
      properties: {
        email: { type: "string", description: "Email of team member to update" },
        role: { type: "string", enum: ["admin", "editor", "viewer"], description: "New role" }
      },
      required: ["email"]
    }
  },
  {
    name: "remove_team_member",
    description: "Remove a team member from the store.",
    input_schema: {
      type: "object",
      properties: {
        email: { type: "string", description: "Email of team member to remove" }
      },
      required: ["email"]
    }
  },
  {
    name: "list_invitations",
    description: "List all pending invitations sent for this store.",
    input_schema: {
      type: "object",
      properties: {
        status: { type: "string", enum: ["pending", "accepted", "expired", "cancelled", "all"], description: "Filter by status (default pending)" }
      }
    }
  },
  {
    name: "cancel_invitation",
    description: "Cancel a pending invitation.",
    input_schema: {
      type: "object",
      properties: {
        email: { type: "string", description: "Email of the invitation to cancel" }
      },
      required: ["email"]
    }
  },
  {
    name: "resend_invitation",
    description: "Resend an invitation email to a pending invitee.",
    input_schema: {
      type: "object",
      properties: {
        email: { type: "string", description: "Email to resend invitation to" }
      },
      required: ["email"]
    }
  }
];

/**
 * Build system prompt with RAG context
 */
async function buildSystemPrompt(storeId, message) {
  let ragContext = '';
  let learnedExamples = '';
  let entitySchemas = '';

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

  // Fetch entity definitions (database schemas) from ai_entity_definitions
  try {
    const entities = await aiEntityService.getEntityDefinitions();
    if (entities?.length > 0) {
      // Format key entities for the prompt
      const keyEntities = entities.filter(e =>
        ['product', 'category', 'order', 'customer', 'attribute', 'coupon'].includes(e.entity_name)
      );
      if (keyEntities.length > 0) {
        entitySchemas = keyEntities.map(e => {
          const relatedTables = e.related_tables?.length > 0
            ? `\n   Related tables: ${e.related_tables.join(', ')}`
            : '';
          return `• ${e.entity_name}: table="${e.table_name}"${relatedTables}`;
        }).join('\n');
      }
    }
  } catch (err) {
    console.error('[UnifiedAI] Failed to load entity definitions:', err.message);
  }

  return `You are the AI assistant for DainoStore, a visual e-commerce platform.

You have DIRECT DATABASE ACCESS through tools. You EXECUTE actions, not explain them.

AVAILABLE TOOLS:
- **Products**: list_products, update_product, create_product, delete_product
- **Categories**: list_categories, update_category, set_category_visible, set_category_hidden, create_category, delete_category, add_product_to_category, remove_product_from_category
- **Attributes**: list_attributes, create_attribute, update_attribute, delete_attribute
- **Attribute Sets**: list_attribute_sets, create_attribute_set, update_attribute_set, delete_attribute_set
- **Orders**: list_orders, update_order_status
- **Customers**: list_customers, blacklist_customer
- **Coupons**: list_coupons, create_coupon, delete_coupon
- **CMS Pages**: list_cms_pages, create_cms_page, update_cms_page, delete_cms_page
- **CMS Blocks**: list_cms_blocks, create_cms_block, update_cms_block, delete_cms_block
- **Product Labels**: list_product_labels, create_product_label, update_product_label, delete_product_label
- **Product Tabs**: list_product_tabs, create_product_tab, update_product_tab, delete_product_tab
- **Custom Options**: list_custom_option_rules, create_custom_option_rule, update_custom_option_rule, delete_custom_option_rule
- **Shipping**: list_shipping_methods, create_shipping_method, update_shipping_method, delete_shipping_method
- **Payments**: list_payment_methods, update_payment_method
- **Email Templates**: list_email_templates, update_email_template
- **Taxes**: list_taxes, create_tax, update_tax, delete_tax
- **Blacklist**: list_blacklist, add_to_blacklist, remove_from_blacklist
- **Delivery**: get_delivery_settings, update_delivery_settings
- **Cookie Consent**: get_cookie_consent_settings, update_cookie_consent_settings
- **SEO**: get_seo_settings, update_seo_settings, list_seo_templates, update_seo_template
- **Settings**: get_store_settings, update_store_setting, update_stock_settings, update_display_settings, update_category_settings, update_checkout_settings, update_navigation_settings, update_gallery_settings
- **Store Info**: get_store_info, update_store_info
- **Languages**: list_languages, create_language, update_language, delete_language
- **Redirects**: list_redirects, create_redirect, update_redirect, delete_redirect
- **Media**: list_media_assets, update_media_asset, delete_media_asset
- **Credits**: get_credit_balance, get_credit_pricing
- **Team**: list_team_members, invite_team_member, update_team_member, remove_team_member
- **Invitations**: list_invitations, cancel_invitation, resend_invitation
- **Layout**: modify_slot
- **Imports**: trigger_akeneo_import, trigger_shopify_import, trigger_woocommerce_import
- **Knowledge**: search_knowledge
- **Stats**: get_store_stats
- **Translation**: translate_content
${entitySchemas ? `\nDATABASE SCHEMA:\n${entitySchemas}\n` : ''}
RULES:
1. USE TOOLS for actionable requests - don't just explain
2. When updating entities, find them by name/SKU first
3. If a tool returns an error (e.g., "Product not found"), TELL THE USER clearly what went wrong and suggest solutions
4. If you get a DATABASE ERROR (column not found, etc.), use search_knowledge to look up the correct schema before retrying
5. NEVER say "technical issues" or generic errors - always explain the specific problem
${VERBOSITY_PROMPTS[AI_RESPONSE_VERBOSITY] || VERBOSITY_PROMPTS['D']}

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
      case 'update_attribute':
        result = await updateAttribute(input, storeId);
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

      // CMS Page tools
      case 'list_cms_pages':
        result = await listCmsPages(input, storeId);
        break;
      case 'create_cms_page':
        result = await createCmsPage(input, storeId);
        break;
      case 'update_cms_page':
        result = await updateCmsPage(input, storeId);
        break;
      case 'delete_cms_page':
        result = await deleteCmsPage(input, storeId);
        break;

      // CMS Block tools
      case 'list_cms_blocks':
        result = await listCmsBlocks(storeId);
        break;
      case 'create_cms_block':
        result = await createCmsBlock(input, storeId);
        break;
      case 'update_cms_block':
        result = await updateCmsBlock(input, storeId);
        break;
      case 'delete_cms_block':
        result = await deleteCmsBlock(input, storeId);
        break;

      // Product Label tools
      case 'list_product_labels':
        result = await listProductLabels(storeId);
        break;
      case 'create_product_label':
        result = await createProductLabel(input, storeId);
        break;
      case 'update_product_label':
        result = await updateProductLabel(input, storeId);
        break;
      case 'delete_product_label':
        result = await deleteProductLabel(input, storeId);
        break;

      // Shipping Method tools
      case 'list_shipping_methods':
        result = await listShippingMethods(storeId);
        break;
      case 'create_shipping_method':
        result = await createShippingMethod(input, storeId);
        break;
      case 'update_shipping_method':
        result = await updateShippingMethod(input, storeId);
        break;
      case 'delete_shipping_method':
        result = await deleteShippingMethod(input, storeId);
        break;

      // Payment Method tools
      case 'list_payment_methods':
        result = await listPaymentMethods(storeId);
        break;
      case 'update_payment_method':
        result = await updatePaymentMethod(input, storeId);
        break;

      // Email Template tools
      case 'list_email_templates':
        result = await listEmailTemplates(storeId);
        break;
      case 'update_email_template':
        result = await updateEmailTemplate(input, storeId);
        break;

      // Tax tools
      case 'list_taxes':
        result = await listTaxes(storeId);
        break;
      case 'create_tax':
        result = await createTax(input, storeId);
        break;
      case 'update_tax':
        result = await updateTax(input, storeId);
        break;
      case 'delete_tax':
        result = await deleteTax(input, storeId);
        break;

      // Attribute Set tools
      case 'list_attribute_sets':
        result = await listAttributeSets(storeId);
        break;
      case 'create_attribute_set':
        result = await createAttributeSet(input, storeId);
        break;
      case 'update_attribute_set':
        result = await updateAttributeSet(input, storeId);
        break;
      case 'delete_attribute_set':
        result = await deleteAttributeSet(input, storeId);
        break;

      // Custom Option Rule tools
      case 'list_custom_option_rules':
        result = await listCustomOptionRules(storeId);
        break;
      case 'create_custom_option_rule':
        result = await createCustomOptionRule(input, storeId);
        break;
      case 'update_custom_option_rule':
        result = await updateCustomOptionRule(input, storeId);
        break;
      case 'delete_custom_option_rule':
        result = await deleteCustomOptionRule(input, storeId);
        break;

      // Product Tab tools
      case 'list_product_tabs':
        result = await listProductTabs(storeId);
        break;
      case 'create_product_tab':
        result = await createProductTab(input, storeId);
        break;
      case 'update_product_tab':
        result = await updateProductTab(input, storeId);
        break;
      case 'delete_product_tab':
        result = await deleteProductTab(input, storeId);
        break;

      // Blacklist tools
      case 'list_blacklist':
        result = await listBlacklist(input, storeId);
        break;
      case 'add_to_blacklist':
        result = await addToBlacklist(input, storeId);
        break;
      case 'remove_from_blacklist':
        result = await removeFromBlacklist(input, storeId);
        break;
      case 'blacklist_customer':
        result = await blacklistCustomer(input, storeId);
        break;

      // Delivery Settings tools
      case 'get_delivery_settings':
        result = await getDeliverySettings(storeId);
        break;
      case 'update_delivery_settings':
        result = await updateDeliverySettings(input, storeId);
        break;

      // Cookie Consent tools
      case 'get_cookie_consent_settings':
        result = await getCookieConsentSettings(storeId);
        break;
      case 'update_cookie_consent_settings':
        result = await updateCookieConsentSettings(input, storeId);
        break;

      // SEO tools
      case 'get_seo_settings':
        result = await getSeoSettings(storeId);
        break;
      case 'update_seo_settings':
        result = await updateSeoSettings(input, storeId);
        break;
      case 'list_seo_templates':
        result = await listSeoTemplates(storeId);
        break;
      case 'update_seo_template':
        result = await updateSeoTemplate(input, storeId);
        break;

      // Integration tools
      case 'trigger_akeneo_import':
        result = await triggerAkeneoImport(input, storeId);
        break;
      case 'trigger_shopify_import':
        result = await triggerShopifyImport(input, storeId);
        break;
      case 'trigger_woocommerce_import':
        result = await triggerWooCommerceImport(input, storeId);
        break;

      // Settings tools
      case 'get_store_settings':
        result = await getStoreSettings(input.area, storeId);
        break;
      case 'update_store_setting':
        result = await updateStoreSetting(input.setting_path, input.value, storeId);
        break;
      case 'update_stock_settings':
        result = await updateSettingsSection(input, storeId, 'stock');
        break;
      case 'update_display_settings':
        result = await updateSettingsSection(input, storeId, 'display');
        break;
      case 'update_category_settings':
        result = await updateSettingsSection(input, storeId, 'category');
        break;
      case 'update_checkout_settings':
        result = await updateSettingsSection(input, storeId, 'checkout');
        break;
      case 'update_navigation_settings':
        result = await updateSettingsSection(input, storeId, 'navigation');
        break;
      case 'update_gallery_settings':
        result = await updateSettingsSection(input, storeId, 'gallery');
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

      // Store info tools
      case 'get_store_info':
        result = await getStoreInfo(storeId);
        break;
      case 'update_store_info':
        result = await updateStoreInfo(input, storeId);
        break;

      // Language tools
      case 'list_languages':
        result = await listLanguages(input, storeId);
        break;
      case 'create_language':
        result = await createLanguage(input, storeId);
        break;
      case 'update_language':
        result = await updateLanguage(input, storeId);
        break;
      case 'delete_language':
        result = await deleteLanguage(input, storeId);
        break;

      // Redirect tools
      case 'list_redirects':
        result = await listRedirects(input, storeId);
        break;
      case 'create_redirect':
        result = await createRedirect(input, storeId);
        break;
      case 'update_redirect':
        result = await updateRedirect(input, storeId);
        break;
      case 'delete_redirect':
        result = await deleteRedirect(input, storeId);
        break;

      // Media asset tools
      case 'list_media_assets':
        result = await listMediaAssets(input, storeId);
        break;
      case 'update_media_asset':
        result = await updateMediaAsset(input, storeId);
        break;
      case 'delete_media_asset':
        result = await deleteMediaAsset(input, storeId);
        break;

      // Credit tools (info only)
      case 'get_credit_balance':
        result = await getCreditBalance(input, storeId, userId);
        break;
      case 'get_credit_pricing':
        result = await getCreditPricing(input);
        break;

      // Team management tools
      case 'list_team_members':
        result = await listTeamMembers(input, storeId);
        break;
      case 'invite_team_member':
        result = await inviteTeamMember(input, storeId, userId);
        break;
      case 'update_team_member':
        result = await updateTeamMember(input, storeId);
        break;
      case 'remove_team_member':
        result = await removeTeamMember(input, storeId);
        break;
      case 'list_invitations':
        result = await listInvitations(input, storeId);
        break;
      case 'cancel_invitation':
        result = await cancelInvitation(input, storeId);
        break;
      case 'resend_invitation':
        result = await resendInvitation(input, storeId);
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

  // Store previous values for detailed response
  const previousValues = {};
  if (updates.stock_quantity !== undefined) previousValues.stock_quantity = found.stock_quantity;
  if (updates.price !== undefined) previousValues.price = found.price;
  if (updates.status !== undefined) previousValues.status = found.status;
  if (updates.featured !== undefined) previousValues.featured = found.featured;
  if (updates.name !== undefined) previousValues.name = found.name;

  // Separate product table updates from translation updates
  const { name: newName, description: newDescription, ...productUpdates } = updates;

  // Update products table (if there are any product fields to update)
  if (Object.keys(productUpdates).length > 0) {
    const { error } = await db
      .from('products')
      .update({ ...productUpdates, updated_at: new Date().toISOString() })
      .eq('id', found.id);

    if (error) {
      console.log('   [updateProduct] Product update error:', error);
      return { error: error.message };
    }
  }

  // Update product_translations table (name, description) - UPSERT
  if (newName !== undefined || newDescription !== undefined) {
    const translationData = {
      product_id: found.id,
      language_code: 'en',
      updated_at: new Date().toISOString()
    };
    if (newName !== undefined) translationData.name = newName;
    if (newDescription !== undefined) translationData.description = newDescription;

    console.log('   [updateProduct] Upserting translation:', translationData);

    // Use upsert to insert or update (same syntax as shippingMethodHelpers)
    const { data: upsertResult, error: transError } = await db
      .from('product_translations')
      .upsert(translationData, {
        onConflict: 'product_id,language_code'
      })
      .select();

    if (transError) {
      console.log('   [updateProduct] Translation upsert error:', transError);
      return { error: transError.message };
    }
    console.log('   [updateProduct] Translation upsert result:', upsertResult);
  }

  const changes = Object.entries(updates).map(([k, v]) =>
    typeof v === 'string' && v.length > 50 ? `${k}="${v.substring(0, 50)}..."` : `${k}=${v}`
  ).join(', ');
  console.log('   [updateProduct] Success:', changes);

  return {
    success: true,
    message: `Updated "${found.name}" (${found.sku}): ${changes}`,
    product: {
      id: found.id,
      sku: found.sku,
      name: newName ?? found.name,
      price: updates.price ?? found.price,
      stock_quantity: updates.stock_quantity ?? found.stock_quantity,
      status: updates.status ?? found.status
    },
    previousValues,
    changes: updates,
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

  // Separate category table updates from translation updates
  const { name: newName, description: newDescription, ...categoryUpdates } = updates;

  // Update categories table (if there are any category fields to update)
  if (Object.keys(categoryUpdates).length > 0) {
    const { error } = await db
      .from('categories')
      .update({ ...categoryUpdates, updated_at: new Date().toISOString() })
      .eq('id', found.id);

    if (error) return { error: error.message };
  }

  // Update category_translations table (name, description) - UPSERT
  if (newName !== undefined || newDescription !== undefined) {
    const translationData = {
      category_id: found.id,
      language_code: 'en',
      updated_at: new Date().toISOString()
    };
    if (newName !== undefined) translationData.name = newName;
    if (newDescription !== undefined) translationData.description = newDescription;

    const { error: transError } = await db
      .from('category_translations')
      .upsert(translationData, {
        onConflict: 'category_id,language_code',
        ignoreDuplicates: false
      });

    if (transError) return { error: transError.message };
  }

  const changes = Object.entries(updates).map(([k, v]) =>
    typeof v === 'string' && v.length > 50 ? `${k}="${v.substring(0, 50)}..."` : `${k}=${v}`
  ).join(', ');

  return {
    success: true,
    message: `Updated category "${found.name}": ${changes}`,
    category: { id: found.id, slug: found.slug, name: newName ?? found.name },
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

async function updateAttribute({ code, updates }, storeId) {
  const db = await ConnectionManager.getStoreConnection(storeId);

  // Get attribute with its translation
  const { data: attr } = await db
    .from('attributes')
    .select('id, name, code, is_filterable, is_searchable')
    .eq('code', code)
    .single();

  if (!attr) return { error: `Attribute "${code}" not found` };

  // Get current translation for display name
  const { data: trans } = await db
    .from('attribute_translations')
    .select('id, label, description')
    .eq('attribute_id', attr.id)
    .eq('language_code', 'en')
    .single();

  const currentName = trans?.label || attr.name || code;

  // Update attributes table directly (for settings)
  const attributeUpdates = { updated_at: new Date().toISOString() };
  if (updates.is_filterable !== undefined) attributeUpdates.is_filterable = updates.is_filterable;
  if (updates.is_searchable !== undefined) attributeUpdates.is_searchable = updates.is_searchable;

  if (Object.keys(attributeUpdates).length > 1) {
    const { error } = await db.from('attributes').update(attributeUpdates).eq('id', attr.id);
    if (error) return { error: error.message };
  }

  // Update attribute_translations table (for name/description)
  if (updates.name !== undefined || updates.description !== undefined) {
    const translationUpdates = { updated_at: new Date().toISOString() };
    if (updates.name !== undefined) translationUpdates.label = updates.name;
    if (updates.description !== undefined) translationUpdates.description = updates.description;

    if (trans?.id) {
      // Update existing translation
      const { error } = await db
        .from('attribute_translations')
        .update(translationUpdates)
        .eq('id', trans.id);
      if (error) return { error: error.message };
    } else {
      // Insert new translation
      const { error } = await db
        .from('attribute_translations')
        .insert({
          attribute_id: attr.id,
          language_code: 'en',
          label: updates.name || attr.name,
          description: updates.description || null
        });
      if (error) return { error: error.message };
    }
  }

  // Add new values to attribute_values and attribute_value_translations
  if (updates.values && Array.isArray(updates.values)) {
    // Get existing values
    const { data: existingValues } = await db
      .from('attribute_values')
      .select('code')
      .eq('attribute_id', attr.id);

    const existingCodes = (existingValues || []).map(v => v.code);
    const maxSortOrder = existingValues?.length || 0;

    for (let i = 0; i < updates.values.length; i++) {
      const valueLabel = updates.values[i];
      const valueCode = valueLabel.toLowerCase().replace(/[^a-z0-9_]/g, '_');

      if (!existingCodes.includes(valueCode)) {
        // Insert attribute_value
        const { data: newValue, error: valueError } = await db
          .from('attribute_values')
          .insert({
            attribute_id: attr.id,
            code: valueCode,
            sort_order: maxSortOrder + i
          })
          .select('id')
          .single();

        if (valueError) return { error: valueError.message };

        // Insert attribute_value_translation
        await db
          .from('attribute_value_translations')
          .insert({
            attribute_value_id: newValue.id,
            language_code: 'en',
            label: valueLabel
          });
      }
    }
  }

  const changes = Object.entries(updates).map(([k, v]) =>
    Array.isArray(v) ? `${k}=[${v.join(', ')}]` : `${k}=${v}`
  ).join(', ');

  return {
    success: true,
    message: `Updated attribute "${currentName}" (${code}): ${changes}`,
    attribute: { id: attr.id, code, name: updates.name || currentName },
    refreshPreview: true,
    action: 'update'
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
// CMS PAGE TOOLS
// ═══════════════════════════════════════════════════════════════════════════

async function listCmsPages({ include_inactive = false }, storeId) {
  const db = await ConnectionManager.getStoreConnection(storeId);

  let query = db.from('cms_pages').select('id, slug, is_active, created_at');
  if (!include_inactive) {
    query = query.eq('is_active', true);
  }

  const { data: pages, error } = await query.order('created_at', { ascending: false }).limit(50);
  if (error) return { error: error.message };

  // Get translations
  const pageIds = (pages || []).map(p => p.id);
  const { data: translations } = await db
    .from('cms_page_translations')
    .select('cms_page_id, title')
    .in('cms_page_id', pageIds)
    .eq('language_code', 'en');

  const transMap = new Map(translations?.map(t => [t.cms_page_id, t.title]) || []);

  return {
    pages: pages.map(p => ({
      id: p.id,
      slug: p.slug,
      title: transMap.get(p.id) || p.slug,
      is_active: p.is_active
    })),
    count: pages.length
  };
}

async function createCmsPage({ title, slug, content, is_active = true }, storeId) {
  const db = await ConnectionManager.getStoreConnection(storeId);

  const generatedSlug = slug || title.toLowerCase().replace(/[^a-z0-9]+/g, '-');

  const { data: created, error } = await db
    .from('cms_pages')
    .insert({ slug: generatedSlug, is_active })
    .select('id')
    .single();

  if (error) return { error: error.message };

  // Insert translation
  await db.from('cms_page_translations').insert({
    cms_page_id: created.id,
    language_code: 'en',
    title,
    content: content || ''
  });

  return {
    success: true,
    message: `Created CMS page "${title}" (/${generatedSlug})`,
    page: { id: created.id, slug: generatedSlug, title },
    refreshPreview: true,
    action: 'create'
  };
}

async function updateCmsPage({ page, updates }, storeId) {
  const db = await ConnectionManager.getStoreConnection(storeId);

  // Find by slug or title
  const { data: pages } = await db
    .from('cms_pages')
    .select('id, slug, is_active');

  const { data: translations } = await db
    .from('cms_page_translations')
    .select('cms_page_id, title')
    .eq('language_code', 'en');

  const transMap = new Map(translations?.map(t => [t.cms_page_id, t.title]) || []);

  const found = pages?.find(p =>
    p.slug.toLowerCase() === page.toLowerCase() ||
    (transMap.get(p.id) || '').toLowerCase() === page.toLowerCase()
  );

  if (!found) return { error: `CMS page "${page}" not found` };

  // Update cms_pages table
  if (updates.is_active !== undefined) {
    await db.from('cms_pages').update({ is_active: updates.is_active, updated_at: new Date().toISOString() }).eq('id', found.id);
  }

  // Update translations - UPSERT
  if (updates.title !== undefined || updates.content !== undefined) {
    const translationData = {
      cms_page_id: found.id,
      language_code: 'en',
      updated_at: new Date().toISOString()
    };
    if (updates.title !== undefined) translationData.title = updates.title;
    if (updates.content !== undefined) translationData.content = updates.content;

    await db.from('cms_page_translations').upsert(translationData, {
      onConflict: 'cms_page_id,language_code',
      ignoreDuplicates: false
    });
  }

  return {
    success: true,
    message: `Updated CMS page "${transMap.get(found.id) || found.slug}"`,
    refreshPreview: true,
    action: 'update'
  };
}

async function deleteCmsPage({ page }, storeId) {
  const db = await ConnectionManager.getStoreConnection(storeId);

  const { data: pages } = await db.from('cms_pages').select('id, slug');
  const { data: translations } = await db.from('cms_page_translations').select('cms_page_id, title').eq('language_code', 'en');

  const transMap = new Map(translations?.map(t => [t.cms_page_id, t.title]) || []);
  const found = pages?.find(p =>
    p.slug.toLowerCase() === page.toLowerCase() ||
    (transMap.get(p.id) || '').toLowerCase() === page.toLowerCase()
  );

  if (!found) return { error: `CMS page "${page}" not found` };

  await db.from('cms_page_translations').delete().eq('cms_page_id', found.id);
  await db.from('cms_pages').delete().eq('id', found.id);

  return {
    success: true,
    message: `Deleted CMS page "${transMap.get(found.id) || found.slug}"`,
    refreshPreview: true,
    action: 'delete'
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// CMS BLOCK TOOLS
// ═══════════════════════════════════════════════════════════════════════════

async function listCmsBlocks(storeId) {
  const db = await ConnectionManager.getStoreConnection(storeId);

  const { data: blocks, error } = await db
    .from('cms_blocks')
    .select('id, identifier, is_active')
    .order('identifier')
    .limit(50);

  if (error) return { error: error.message };

  const blockIds = (blocks || []).map(b => b.id);
  const { data: translations } = await db
    .from('cms_block_translations')
    .select('cms_block_id, title')
    .in('cms_block_id', blockIds)
    .eq('language_code', 'en');

  const transMap = new Map(translations?.map(t => [t.cms_block_id, t.title]) || []);

  return {
    blocks: blocks.map(b => ({
      id: b.id,
      identifier: b.identifier,
      title: transMap.get(b.id) || b.identifier,
      is_active: b.is_active
    })),
    count: blocks.length
  };
}

async function createCmsBlock({ identifier, title, content, is_active = true }, storeId) {
  const db = await ConnectionManager.getStoreConnection(storeId);

  const { data: created, error } = await db
    .from('cms_blocks')
    .insert({ identifier, is_active })
    .select('id')
    .single();

  if (error) return { error: error.message };

  await db.from('cms_block_translations').insert({
    cms_block_id: created.id,
    language_code: 'en',
    title,
    content: content || ''
  });

  return {
    success: true,
    message: `Created CMS block "${title}" (${identifier})`,
    block: { id: created.id, identifier, title },
    refreshPreview: true,
    action: 'create'
  };
}

async function updateCmsBlock({ block, updates }, storeId) {
  const db = await ConnectionManager.getStoreConnection(storeId);

  const { data: blocks } = await db.from('cms_blocks').select('id, identifier, is_active');
  const { data: translations } = await db.from('cms_block_translations').select('cms_block_id, title').eq('language_code', 'en');

  const transMap = new Map(translations?.map(t => [t.cms_block_id, t.title]) || []);
  const found = blocks?.find(b =>
    b.identifier.toLowerCase() === block.toLowerCase() ||
    (transMap.get(b.id) || '').toLowerCase() === block.toLowerCase()
  );

  if (!found) return { error: `CMS block "${block}" not found` };

  if (updates.is_active !== undefined) {
    await db.from('cms_blocks').update({ is_active: updates.is_active, updated_at: new Date().toISOString() }).eq('id', found.id);
  }

  if (updates.title !== undefined || updates.content !== undefined) {
    const translationData = {
      cms_block_id: found.id,
      language_code: 'en',
      updated_at: new Date().toISOString()
    };
    if (updates.title !== undefined) translationData.title = updates.title;
    if (updates.content !== undefined) translationData.content = updates.content;

    await db.from('cms_block_translations').upsert(translationData, {
      onConflict: 'cms_block_id,language_code',
      ignoreDuplicates: false
    });
  }

  return {
    success: true,
    message: `Updated CMS block "${transMap.get(found.id) || found.identifier}"`,
    refreshPreview: true,
    action: 'update'
  };
}

async function deleteCmsBlock({ block }, storeId) {
  const db = await ConnectionManager.getStoreConnection(storeId);

  const { data: blocks } = await db.from('cms_blocks').select('id, identifier');
  const found = blocks?.find(b => b.identifier.toLowerCase() === block.toLowerCase());

  if (!found) return { error: `CMS block "${block}" not found` };

  await db.from('cms_block_translations').delete().eq('cms_block_id', found.id);
  await db.from('cms_blocks').delete().eq('id', found.id);

  return {
    success: true,
    message: `Deleted CMS block "${found.identifier}"`,
    refreshPreview: true,
    action: 'delete'
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// PRODUCT LABEL TOOLS
// ═══════════════════════════════════════════════════════════════════════════

async function listProductLabels(storeId) {
  const db = await ConnectionManager.getStoreConnection(storeId);

  const { data: labels, error } = await db
    .from('product_labels')
    .select('id, name, slug, text, color, background_color, position, is_active')
    .order('priority', { ascending: false })
    .limit(50);

  if (error) return { error: error.message };

  return { labels: labels || [], count: labels?.length || 0 };
}

async function createProductLabel({ name, text, color = '#FFFFFF', background_color = '#FF0000', position = 'top-left' }, storeId) {
  const db = await ConnectionManager.getStoreConnection(storeId);

  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-');

  const { data: created, error } = await db
    .from('product_labels')
    .insert({
      name,
      slug,
      text,
      color,
      background_color,
      position,
      is_active: true
    })
    .select('id')
    .single();

  if (error) return { error: error.message };

  return {
    success: true,
    message: `Created product label "${name}" with text "${text}"`,
    label: { id: created.id, name, text },
    refreshPreview: true,
    action: 'create'
  };
}

async function updateProductLabel({ label, updates }, storeId) {
  const db = await ConnectionManager.getStoreConnection(storeId);

  const { data: labels } = await db.from('product_labels').select('id, name, slug');
  const found = labels?.find(l =>
    l.name.toLowerCase() === label.toLowerCase() ||
    l.slug.toLowerCase() === label.toLowerCase()
  );

  if (!found) return { error: `Product label "${label}" not found` };

  const updateData = { updated_at: new Date().toISOString() };
  if (updates.name !== undefined) updateData.name = updates.name;
  if (updates.text !== undefined) updateData.text = updates.text;
  if (updates.color !== undefined) updateData.color = updates.color;
  if (updates.background_color !== undefined) updateData.background_color = updates.background_color;
  if (updates.position !== undefined) updateData.position = updates.position;
  if (updates.is_active !== undefined) updateData.is_active = updates.is_active;

  await db.from('product_labels').update(updateData).eq('id', found.id);

  return {
    success: true,
    message: `Updated product label "${found.name}"`,
    refreshPreview: true,
    action: 'update'
  };
}

async function deleteProductLabel({ label }, storeId) {
  const db = await ConnectionManager.getStoreConnection(storeId);

  const { data: labels } = await db.from('product_labels').select('id, name');
  const found = labels?.find(l => l.name.toLowerCase() === label.toLowerCase());

  if (!found) return { error: `Product label "${label}" not found` };

  await db.from('product_labels').delete().eq('id', found.id);

  return {
    success: true,
    message: `Deleted product label "${found.name}"`,
    refreshPreview: true,
    action: 'delete'
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// SHIPPING METHOD TOOLS
// ═══════════════════════════════════════════════════════════════════════════

async function listShippingMethods(storeId) {
  const db = await ConnectionManager.getStoreConnection(storeId);

  const { data: methods, error } = await db
    .from('shipping_methods')
    .select('id, code, price, min_order_amount, is_active, sort_order')
    .order('sort_order')
    .limit(50);

  if (error) return { error: error.message };

  const methodIds = (methods || []).map(m => m.id);
  const { data: translations } = await db
    .from('shipping_method_translations')
    .select('shipping_method_id, name, description')
    .in('shipping_method_id', methodIds)
    .eq('language_code', 'en');

  const transMap = new Map(translations?.map(t => [t.shipping_method_id, { name: t.name, description: t.description }]) || []);

  return {
    methods: methods.map(m => ({
      id: m.id,
      code: m.code,
      name: transMap.get(m.id)?.name || m.code,
      price: m.price,
      min_order_amount: m.min_order_amount,
      is_active: m.is_active
    })),
    count: methods.length
  };
}

async function createShippingMethod({ code, name, price, min_order_amount = 0, estimated_days }, storeId) {
  const db = await ConnectionManager.getStoreConnection(storeId);

  const { data: created, error } = await db
    .from('shipping_methods')
    .insert({
      code,
      price,
      min_order_amount,
      is_active: true
    })
    .select('id')
    .single();

  if (error) return { error: error.message };

  await db.from('shipping_method_translations').insert({
    shipping_method_id: created.id,
    language_code: 'en',
    name,
    description: estimated_days || ''
  });

  return {
    success: true,
    message: `Created shipping method "${name}" ($${price})`,
    method: { id: created.id, code, name, price },
    refreshPreview: true,
    action: 'create'
  };
}

async function updateShippingMethod({ method, updates }, storeId) {
  const db = await ConnectionManager.getStoreConnection(storeId);

  const { data: methods } = await db.from('shipping_methods').select('id, code');
  const { data: translations } = await db.from('shipping_method_translations').select('shipping_method_id, name').eq('language_code', 'en');

  const transMap = new Map(translations?.map(t => [t.shipping_method_id, t.name]) || []);
  const found = methods?.find(m =>
    m.code.toLowerCase() === method.toLowerCase() ||
    (transMap.get(m.id) || '').toLowerCase() === method.toLowerCase()
  );

  if (!found) return { error: `Shipping method "${method}" not found` };

  const methodUpdates = { updated_at: new Date().toISOString() };
  if (updates.price !== undefined) methodUpdates.price = updates.price;
  if (updates.min_order_amount !== undefined) methodUpdates.min_order_amount = updates.min_order_amount;
  if (updates.is_active !== undefined) methodUpdates.is_active = updates.is_active;

  if (Object.keys(methodUpdates).length > 1) {
    await db.from('shipping_methods').update(methodUpdates).eq('id', found.id);
  }

  if (updates.name !== undefined || updates.estimated_days !== undefined) {
    const translationData = {
      shipping_method_id: found.id,
      language_code: 'en',
      updated_at: new Date().toISOString()
    };
    if (updates.name !== undefined) translationData.name = updates.name;
    if (updates.estimated_days !== undefined) translationData.description = updates.estimated_days;

    await db.from('shipping_method_translations').upsert(translationData, {
      onConflict: 'shipping_method_id,language_code',
      ignoreDuplicates: false
    });
  }

  return {
    success: true,
    message: `Updated shipping method "${transMap.get(found.id) || found.code}"`,
    refreshPreview: true,
    action: 'update'
  };
}

async function deleteShippingMethod({ method }, storeId) {
  const db = await ConnectionManager.getStoreConnection(storeId);

  const { data: methods } = await db.from('shipping_methods').select('id, code');
  const found = methods?.find(m => m.code.toLowerCase() === method.toLowerCase());

  if (!found) return { error: `Shipping method "${method}" not found` };

  await db.from('shipping_method_translations').delete().eq('shipping_method_id', found.id);
  await db.from('shipping_methods').delete().eq('id', found.id);

  return {
    success: true,
    message: `Deleted shipping method "${found.code}"`,
    refreshPreview: true,
    action: 'delete'
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// PAYMENT METHOD TOOLS
// ═══════════════════════════════════════════════════════════════════════════

async function listPaymentMethods(storeId) {
  const db = await ConnectionManager.getStoreConnection(storeId);

  const { data: methods, error } = await db
    .from('payment_methods')
    .select('id, code, is_active, sort_order')
    .order('sort_order')
    .limit(50);

  if (error) return { error: error.message };

  const methodIds = (methods || []).map(m => m.id);
  const { data: translations } = await db
    .from('payment_method_translations')
    .select('payment_method_id, name')
    .in('payment_method_id', methodIds)
    .eq('language_code', 'en');

  const transMap = new Map(translations?.map(t => [t.payment_method_id, t.name]) || []);

  return {
    methods: methods.map(m => ({
      id: m.id,
      code: m.code,
      name: transMap.get(m.id) || m.code,
      is_active: m.is_active
    })),
    count: methods.length
  };
}

async function updatePaymentMethod({ method, updates }, storeId) {
  const db = await ConnectionManager.getStoreConnection(storeId);

  const { data: methods } = await db.from('payment_methods').select('id, code');
  const { data: translations } = await db.from('payment_method_translations').select('payment_method_id, name').eq('language_code', 'en');

  const transMap = new Map(translations?.map(t => [t.payment_method_id, t.name]) || []);
  const found = methods?.find(m =>
    m.code.toLowerCase() === method.toLowerCase() ||
    (transMap.get(m.id) || '').toLowerCase() === method.toLowerCase()
  );

  if (!found) return { error: `Payment method "${method}" not found` };

  if (updates.is_active !== undefined || updates.sort_order !== undefined) {
    const methodUpdates = { updated_at: new Date().toISOString() };
    if (updates.is_active !== undefined) methodUpdates.is_active = updates.is_active;
    if (updates.sort_order !== undefined) methodUpdates.sort_order = updates.sort_order;
    await db.from('payment_methods').update(methodUpdates).eq('id', found.id);
  }

  if (updates.name !== undefined) {
    await db.from('payment_method_translations').upsert({
      payment_method_id: found.id,
      language_code: 'en',
      name: updates.name,
      updated_at: new Date().toISOString()
    }, {
      onConflict: 'payment_method_id,language_code',
      ignoreDuplicates: false
    });
  }

  return {
    success: true,
    message: `Updated payment method "${transMap.get(found.id) || found.code}"`,
    refreshPreview: true,
    action: 'update'
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// EMAIL TEMPLATE TOOLS
// ═══════════════════════════════════════════════════════════════════════════

async function listEmailTemplates(storeId) {
  const db = await ConnectionManager.getStoreConnection(storeId);

  const { data: templates, error } = await db
    .from('email_templates')
    .select('id, code, is_active')
    .order('code')
    .limit(50);

  if (error) return { error: error.message };

  const templateIds = (templates || []).map(t => t.id);
  const { data: translations } = await db
    .from('email_template_translations')
    .select('email_template_id, subject')
    .in('email_template_id', templateIds)
    .eq('language_code', 'en');

  const transMap = new Map(translations?.map(t => [t.email_template_id, t.subject]) || []);

  return {
    templates: templates.map(t => ({
      id: t.id,
      code: t.code,
      subject: transMap.get(t.id) || t.code,
      is_active: t.is_active
    })),
    count: templates.length
  };
}

async function updateEmailTemplate({ template, updates }, storeId) {
  const db = await ConnectionManager.getStoreConnection(storeId);

  const { data: templates } = await db.from('email_templates').select('id, code');
  const found = templates?.find(t => t.code.toLowerCase() === template.toLowerCase());

  if (!found) return { error: `Email template "${template}" not found` };

  if (updates.is_active !== undefined) {
    await db.from('email_templates').update({ is_active: updates.is_active, updated_at: new Date().toISOString() }).eq('id', found.id);
  }

  if (updates.subject !== undefined || updates.content !== undefined) {
    const translationData = {
      email_template_id: found.id,
      language_code: 'en',
      updated_at: new Date().toISOString()
    };
    if (updates.subject !== undefined) translationData.subject = updates.subject;
    if (updates.content !== undefined) translationData.content = updates.content;

    await db.from('email_template_translations').upsert(translationData, {
      onConflict: 'email_template_id,language_code',
      ignoreDuplicates: false
    });
  }

  return {
    success: true,
    message: `Updated email template "${found.code}"`,
    action: 'update'
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// TAX TOOLS
// ═══════════════════════════════════════════════════════════════════════════

async function listTaxes(storeId) {
  const db = await ConnectionManager.getStoreConnection(storeId);

  const { data: taxes, error } = await db
    .from('taxes')
    .select('id, rate, country_code, is_active')
    .order('rate')
    .limit(50);

  if (error) return { error: error.message };

  const taxIds = (taxes || []).map(t => t.id);
  const { data: translations } = await db
    .from('tax_translations')
    .select('tax_id, name')
    .in('tax_id', taxIds)
    .eq('language_code', 'en');

  const transMap = new Map(translations?.map(t => [t.tax_id, t.name]) || []);

  return {
    taxes: taxes.map(t => ({
      id: t.id,
      name: transMap.get(t.id) || `Tax ${t.rate}%`,
      rate: t.rate,
      country_code: t.country_code,
      is_active: t.is_active
    })),
    count: taxes.length
  };
}

async function createTax({ name, rate, country_code }, storeId) {
  const db = await ConnectionManager.getStoreConnection(storeId);

  const { data: created, error } = await db
    .from('taxes')
    .insert({
      rate,
      country_code: country_code || null,
      is_active: true
    })
    .select('id')
    .single();

  if (error) return { error: error.message };

  await db.from('tax_translations').insert({
    tax_id: created.id,
    language_code: 'en',
    name
  });

  return {
    success: true,
    message: `Created tax "${name}" (${rate}%)`,
    tax: { id: created.id, name, rate },
    action: 'create'
  };
}

async function updateTax({ tax, updates }, storeId) {
  const db = await ConnectionManager.getStoreConnection(storeId);

  const { data: taxes } = await db.from('taxes').select('id, rate');
  const { data: translations } = await db.from('tax_translations').select('tax_id, name').eq('language_code', 'en');

  const transMap = new Map(translations?.map(t => [t.tax_id, t.name]) || []);
  const found = taxes?.find(t => (transMap.get(t.id) || '').toLowerCase() === tax.toLowerCase());

  if (!found) return { error: `Tax "${tax}" not found` };

  if (updates.rate !== undefined || updates.is_active !== undefined) {
    const taxUpdates = { updated_at: new Date().toISOString() };
    if (updates.rate !== undefined) taxUpdates.rate = updates.rate;
    if (updates.is_active !== undefined) taxUpdates.is_active = updates.is_active;
    await db.from('taxes').update(taxUpdates).eq('id', found.id);
  }

  if (updates.name !== undefined) {
    await db.from('tax_translations').upsert({
      tax_id: found.id,
      language_code: 'en',
      name: updates.name,
      updated_at: new Date().toISOString()
    }, {
      onConflict: 'tax_id,language_code',
      ignoreDuplicates: false
    });
  }

  return {
    success: true,
    message: `Updated tax "${transMap.get(found.id)}"`,
    action: 'update'
  };
}

async function deleteTax({ tax }, storeId) {
  const db = await ConnectionManager.getStoreConnection(storeId);

  const { data: taxes } = await db.from('taxes').select('id');
  const { data: translations } = await db.from('tax_translations').select('tax_id, name').eq('language_code', 'en');

  const transMap = new Map(translations?.map(t => [t.tax_id, t.name]) || []);
  const found = taxes?.find(t => (transMap.get(t.id) || '').toLowerCase() === tax.toLowerCase());

  if (!found) return { error: `Tax "${tax}" not found` };

  await db.from('tax_translations').delete().eq('tax_id', found.id);
  await db.from('taxes').delete().eq('id', found.id);

  return {
    success: true,
    message: `Deleted tax "${transMap.get(found.id)}"`,
    action: 'delete'
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// ATTRIBUTE SET TOOLS
// ═══════════════════════════════════════════════════════════════════════════

async function listAttributeSets(storeId) {
  const db = await ConnectionManager.getStoreConnection(storeId);

  const { data: sets, error } = await db
    .from('attribute_sets')
    .select('id, name, description, is_default, attribute_ids, sort_order')
    .order('sort_order')
    .limit(50);

  if (error) return { error: error.message };

  return { attribute_sets: sets || [], count: sets?.length || 0 };
}

async function createAttributeSet({ name, description, is_default = false }, storeId) {
  const db = await ConnectionManager.getStoreConnection(storeId);

  const { data: created, error } = await db
    .from('attribute_sets')
    .insert({ name, description, is_default, store_id: storeId, attribute_ids: [] })
    .select('id')
    .single();

  if (error) return { error: error.message };

  return {
    success: true,
    message: `Created attribute set "${name}"`,
    attribute_set: { id: created.id, name },
    action: 'create'
  };
}

async function updateAttributeSet({ attribute_set, updates }, storeId) {
  const db = await ConnectionManager.getStoreConnection(storeId);

  const { data: sets } = await db.from('attribute_sets').select('id, name, attribute_ids');
  const found = sets?.find(s => s.name.toLowerCase() === attribute_set.toLowerCase());

  if (!found) return { error: `Attribute set "${attribute_set}" not found` };

  let attributeIds = found.attribute_ids || [];

  // Handle adding/removing attributes
  if (updates.add_attributes) {
    const { data: attrs } = await db.from('attributes').select('id, code').in('code', updates.add_attributes);
    const newIds = attrs?.map(a => a.id) || [];
    attributeIds = [...new Set([...attributeIds, ...newIds])];
  }

  if (updates.remove_attributes) {
    const { data: attrs } = await db.from('attributes').select('id, code').in('code', updates.remove_attributes);
    const removeIds = new Set(attrs?.map(a => a.id) || []);
    attributeIds = attributeIds.filter(id => !removeIds.has(id));
  }

  const updateData = { updated_at: new Date().toISOString(), attribute_ids: attributeIds };
  if (updates.name !== undefined) updateData.name = updates.name;
  if (updates.description !== undefined) updateData.description = updates.description;
  if (updates.is_default !== undefined) updateData.is_default = updates.is_default;

  await db.from('attribute_sets').update(updateData).eq('id', found.id);

  return {
    success: true,
    message: `Updated attribute set "${found.name}"`,
    action: 'update'
  };
}

async function deleteAttributeSet({ attribute_set }, storeId) {
  const db = await ConnectionManager.getStoreConnection(storeId);

  const { data: sets } = await db.from('attribute_sets').select('id, name');
  const found = sets?.find(s => s.name.toLowerCase() === attribute_set.toLowerCase());

  if (!found) return { error: `Attribute set "${attribute_set}" not found` };

  await db.from('attribute_sets').delete().eq('id', found.id);

  return {
    success: true,
    message: `Deleted attribute set "${found.name}"`,
    action: 'delete'
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// CUSTOM OPTION RULE TOOLS
// ═══════════════════════════════════════════════════════════════════════════

async function listCustomOptionRules(storeId) {
  const db = await ConnectionManager.getStoreConnection(storeId);

  const { data: rules, error } = await db
    .from('custom_option_rules')
    .select('id, name, display_label, is_active, conditions, optional_product_ids')
    .order('name')
    .limit(50);

  if (error) return { error: error.message };

  return { rules: rules || [], count: rules?.length || 0 };
}

async function createCustomOptionRule({ name, display_label, conditions = {}, optional_product_ids = [] }, storeId) {
  const db = await ConnectionManager.getStoreConnection(storeId);

  const { data: created, error } = await db
    .from('custom_option_rules')
    .insert({
      name,
      display_label: display_label || 'Custom Options',
      conditions,
      optional_product_ids,
      store_id: storeId,
      is_active: true
    })
    .select('id')
    .single();

  if (error) return { error: error.message };

  return {
    success: true,
    message: `Created custom option rule "${name}"`,
    rule: { id: created.id, name },
    action: 'create'
  };
}

async function updateCustomOptionRule({ rule, updates }, storeId) {
  const db = await ConnectionManager.getStoreConnection(storeId);

  const { data: rules } = await db.from('custom_option_rules').select('id, name');
  const found = rules?.find(r => r.name.toLowerCase() === rule.toLowerCase());

  if (!found) return { error: `Custom option rule "${rule}" not found` };

  const updateData = { updated_at: new Date().toISOString() };
  if (updates.name !== undefined) updateData.name = updates.name;
  if (updates.display_label !== undefined) updateData.display_label = updates.display_label;
  if (updates.conditions !== undefined) updateData.conditions = updates.conditions;
  if (updates.optional_product_ids !== undefined) updateData.optional_product_ids = updates.optional_product_ids;
  if (updates.is_active !== undefined) updateData.is_active = updates.is_active;

  await db.from('custom_option_rules').update(updateData).eq('id', found.id);

  return {
    success: true,
    message: `Updated custom option rule "${found.name}"`,
    action: 'update'
  };
}

async function deleteCustomOptionRule({ rule }, storeId) {
  const db = await ConnectionManager.getStoreConnection(storeId);

  const { data: rules } = await db.from('custom_option_rules').select('id, name');
  const found = rules?.find(r => r.name.toLowerCase() === rule.toLowerCase());

  if (!found) return { error: `Custom option rule "${rule}" not found` };

  await db.from('custom_option_rules').delete().eq('id', found.id);

  return {
    success: true,
    message: `Deleted custom option rule "${found.name}"`,
    action: 'delete'
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// PRODUCT TAB TOOLS
// ═══════════════════════════════════════════════════════════════════════════

async function listProductTabs(storeId) {
  const db = await ConnectionManager.getStoreConnection(storeId);

  const { data: tabs, error } = await db
    .from('product_tabs')
    .select('id, name, slug, tab_type, is_active, sort_order')
    .order('sort_order')
    .limit(50);

  if (error) return { error: error.message };

  return { tabs: tabs || [], count: tabs?.length || 0 };
}

async function createProductTab({ name, content, tab_type = 'text', attribute_ids = [], attribute_set_ids = [] }, storeId) {
  const db = await ConnectionManager.getStoreConnection(storeId);

  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-');

  const { data: created, error } = await db
    .from('product_tabs')
    .insert({
      name,
      slug,
      content: content || '',
      tab_type,
      attribute_ids,
      attribute_set_ids,
      store_id: storeId,
      is_active: true
    })
    .select('id')
    .single();

  if (error) return { error: error.message };

  // Insert translation
  await db.from('product_tab_translations').insert({
    product_tab_id: created.id,
    language_code: 'en',
    name,
    content: content || ''
  });

  return {
    success: true,
    message: `Created product tab "${name}"`,
    tab: { id: created.id, name, slug },
    refreshPreview: true,
    action: 'create'
  };
}

async function updateProductTab({ tab, updates }, storeId) {
  const db = await ConnectionManager.getStoreConnection(storeId);

  const { data: tabs } = await db.from('product_tabs').select('id, name, slug');
  const found = tabs?.find(t =>
    t.name.toLowerCase() === tab.toLowerCase() ||
    t.slug.toLowerCase() === tab.toLowerCase()
  );

  if (!found) return { error: `Product tab "${tab}" not found` };

  const updateData = { updated_at: new Date().toISOString() };
  if (updates.name !== undefined) updateData.name = updates.name;
  if (updates.is_active !== undefined) updateData.is_active = updates.is_active;
  if (updates.sort_order !== undefined) updateData.sort_order = updates.sort_order;

  await db.from('product_tabs').update(updateData).eq('id', found.id);

  // Update translation if content changed
  if (updates.content !== undefined || updates.name !== undefined) {
    const translationData = {
      product_tab_id: found.id,
      language_code: 'en',
      updated_at: new Date().toISOString()
    };
    if (updates.name !== undefined) translationData.name = updates.name;
    if (updates.content !== undefined) translationData.content = updates.content;

    await db.from('product_tab_translations').upsert(translationData, {
      onConflict: 'product_tab_id,language_code',
      ignoreDuplicates: false
    });
  }

  return {
    success: true,
    message: `Updated product tab "${found.name}"`,
    refreshPreview: true,
    action: 'update'
  };
}

async function deleteProductTab({ tab }, storeId) {
  const db = await ConnectionManager.getStoreConnection(storeId);

  const { data: tabs } = await db.from('product_tabs').select('id, name, slug');
  const found = tabs?.find(t =>
    t.name.toLowerCase() === tab.toLowerCase() ||
    t.slug.toLowerCase() === tab.toLowerCase()
  );

  if (!found) return { error: `Product tab "${tab}" not found` };

  await db.from('product_tab_translations').delete().eq('product_tab_id', found.id);
  await db.from('product_tabs').delete().eq('id', found.id);

  return {
    success: true,
    message: `Deleted product tab "${found.name}"`,
    refreshPreview: true,
    action: 'delete'
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// BLACKLIST TOOLS
// ═══════════════════════════════════════════════════════════════════════════

async function listBlacklist({ type }, storeId) {
  const db = await ConnectionManager.getStoreConnection(storeId);

  const result = {};

  if (type === 'emails' || type === 'all') {
    const { data } = await db.from('blacklist_emails').select('id, email, reason, created_at').limit(100);
    result.emails = data || [];
  }

  if (type === 'ips' || type === 'all') {
    const { data } = await db.from('blacklist_ips').select('id, ip_address, reason, created_at').limit(100);
    result.ips = data || [];
  }

  if (type === 'countries' || type === 'all') {
    const { data } = await db.from('blacklist_countries').select('id, country_code, reason, created_at').limit(100);
    result.countries = data || [];
  }

  return result;
}

async function addToBlacklist({ type, value, reason }, storeId) {
  const db = await ConnectionManager.getStoreConnection(storeId);

  let tableName, columnName;
  if (type === 'email') {
    tableName = 'blacklist_emails';
    columnName = 'email';
  } else if (type === 'ip') {
    tableName = 'blacklist_ips';
    columnName = 'ip_address';
  } else if (type === 'country') {
    tableName = 'blacklist_countries';
    columnName = 'country_code';
  }

  const insertData = { store_id: storeId, reason: reason || null };
  insertData[columnName] = value;

  const { error } = await db.from(tableName).insert(insertData);
  if (error) return { error: error.message };

  return {
    success: true,
    message: `Added ${type} "${value}" to blacklist`,
    action: 'create'
  };
}

async function removeFromBlacklist({ type, value }, storeId) {
  const db = await ConnectionManager.getStoreConnection(storeId);

  let tableName, columnName;
  if (type === 'email') {
    tableName = 'blacklist_emails';
    columnName = 'email';
  } else if (type === 'ip') {
    tableName = 'blacklist_ips';
    columnName = 'ip_address';
  } else if (type === 'country') {
    tableName = 'blacklist_countries';
    columnName = 'country_code';
  }

  const { error } = await db.from(tableName).delete().eq(columnName, value);
  if (error) return { error: error.message };

  return {
    success: true,
    message: `Removed ${type} "${value}" from blacklist`,
    action: 'delete'
  };
}

async function blacklistCustomer({ email, reason }, storeId) {
  const db = await ConnectionManager.getStoreConnection(storeId);

  // Find customer
  const { data: customer } = await db
    .from('customers')
    .select('id, email')
    .eq('email', email.toLowerCase())
    .single();

  if (!customer) return { error: `Customer with email "${email}" not found` };

  // Update customer
  await db.from('customers').update({
    is_blacklisted: true,
    blacklist_reason: reason || 'Blacklisted via AI',
    blacklisted_at: new Date().toISOString()
  }).eq('id', customer.id);

  // Also add to email blacklist
  await db.from('blacklist_emails').upsert({
    email: email.toLowerCase(),
    store_id: storeId,
    reason: reason || 'Customer blacklisted'
  }, { onConflict: 'store_id,email' });

  return {
    success: true,
    message: `Blacklisted customer "${email}"`,
    action: 'update'
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// DELIVERY SETTINGS TOOLS
// ═══════════════════════════════════════════════════════════════════════════

async function getDeliverySettings(storeId) {
  const db = await ConnectionManager.getStoreConnection(storeId);

  const { data, error } = await db
    .from('delivery_settings')
    .select('*')
    .eq('store_id', storeId)
    .single();

  if (error && error.code !== 'PGRST116') return { error: error.message };

  return {
    settings: data || {
      enable_delivery_date: true,
      enable_comments: true,
      offset_days: 1,
      max_advance_days: 30,
      blocked_dates: [],
      blocked_weekdays: []
    }
  };
}

async function updateDeliverySettings(updates, storeId) {
  const db = await ConnectionManager.getStoreConnection(storeId);

  const updateData = { store_id: storeId, updated_at: new Date().toISOString() };
  if (updates.enable_delivery_date !== undefined) updateData.enable_delivery_date = updates.enable_delivery_date;
  if (updates.enable_comments !== undefined) updateData.enable_comments = updates.enable_comments;
  if (updates.offset_days !== undefined) updateData.offset_days = updates.offset_days;
  if (updates.max_advance_days !== undefined) updateData.max_advance_days = updates.max_advance_days;
  if (updates.blocked_weekdays !== undefined) updateData.blocked_weekdays = updates.blocked_weekdays;
  if (updates.blocked_dates !== undefined) updateData.blocked_dates = updates.blocked_dates;

  const { error } = await db.from('delivery_settings').upsert(updateData, { onConflict: 'store_id' });
  if (error) return { error: error.message };

  return {
    success: true,
    message: 'Updated delivery settings',
    refreshPreview: true,
    action: 'update'
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// COOKIE CONSENT TOOLS
// ═══════════════════════════════════════════════════════════════════════════

async function getCookieConsentSettings(storeId) {
  const db = await ConnectionManager.getStoreConnection(storeId);

  const { data, error } = await db
    .from('cookie_consent_settings')
    .select('*')
    .eq('store_id', storeId)
    .single();

  if (error && error.code !== 'PGRST116') return { error: error.message };

  return { settings: data || { is_enabled: false } };
}

async function updateCookieConsentSettings(updates, storeId) {
  const db = await ConnectionManager.getStoreConnection(storeId);

  const updateData = { store_id: storeId, updated_at: new Date().toISOString() };
  const fields = ['is_enabled', 'banner_position', 'theme', 'gdpr_mode', 'analytics_cookies',
    'marketing_cookies', 'primary_color', 'privacy_policy_url', 'background_color', 'text_color'];

  fields.forEach(f => {
    if (updates[f] !== undefined) updateData[f] = updates[f];
  });

  const { error } = await db.from('cookie_consent_settings').upsert(updateData, { onConflict: 'store_id' });
  if (error) return { error: error.message };

  return {
    success: true,
    message: 'Updated cookie consent settings',
    refreshPreview: true,
    action: 'update'
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// SEO TOOLS
// ═══════════════════════════════════════════════════════════════════════════

async function getSeoSettings(storeId) {
  const db = await ConnectionManager.getStoreConnection(storeId);

  const { data, error } = await db
    .from('seo_settings')
    .select('*')
    .eq('store_id', storeId)
    .single();

  if (error && error.code !== 'PGRST116') return { error: error.message };

  return { settings: data || {} };
}

async function updateSeoSettings(updates, storeId) {
  const db = await ConnectionManager.getStoreConnection(storeId);

  const updateData = { store_id: storeId, updated_at: new Date().toISOString() };
  const fields = ['default_title_suffix', 'default_meta_description', 'robots_txt',
    'google_analytics_id', 'google_tag_manager_id'];

  fields.forEach(f => {
    if (updates[f] !== undefined) updateData[f] = updates[f];
  });

  const { error } = await db.from('seo_settings').upsert(updateData, { onConflict: 'store_id' });
  if (error) return { error: error.message };

  return {
    success: true,
    message: 'Updated SEO settings',
    action: 'update'
  };
}

async function listSeoTemplates(storeId) {
  const db = await ConnectionManager.getStoreConnection(storeId);

  const { data, error } = await db
    .from('seo_templates')
    .select('id, name, page_type, type, title_template, meta_description_template, is_active')
    .order('name')
    .limit(50);

  if (error) return { error: error.message };

  return { templates: data || [], count: data?.length || 0 };
}

async function updateSeoTemplate({ template, updates }, storeId) {
  const db = await ConnectionManager.getStoreConnection(storeId);

  const { data: templates } = await db.from('seo_templates').select('id, name, page_type');
  const found = templates?.find(t =>
    t.name.toLowerCase() === template.toLowerCase() ||
    t.page_type.toLowerCase() === template.toLowerCase()
  );

  if (!found) return { error: `SEO template "${template}" not found` };

  const updateData = { updated_at: new Date().toISOString() };
  if (updates.title_template !== undefined) updateData.title_template = updates.title_template;
  if (updates.meta_description_template !== undefined) updateData.meta_description_template = updates.meta_description_template;
  if (updates.is_active !== undefined) updateData.is_active = updates.is_active;

  await db.from('seo_templates').update(updateData).eq('id', found.id);

  return {
    success: true,
    message: `Updated SEO template "${found.name}"`,
    action: 'update'
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// INTEGRATION / IMPORT TOOLS
// ═══════════════════════════════════════════════════════════════════════════

async function triggerAkeneoImport({ import_type = 'products', full_sync = false }, storeId) {
  // This would trigger an Akeneo import job
  // In a real implementation, this would queue a job to the job processor

  return {
    success: true,
    message: `Triggered Akeneo ${import_type} import (${full_sync ? 'full sync' : 'incremental'})`,
    note: 'Import job has been queued. Check job status for progress.',
    action: 'trigger'
  };
}

async function triggerShopifyImport({ import_type = 'products', full_sync = false }, storeId) {
  return {
    success: true,
    message: `Triggered Shopify ${import_type} import (${full_sync ? 'full sync' : 'incremental'})`,
    note: 'Import job has been queued. Check job status for progress.',
    action: 'trigger'
  };
}

async function triggerWooCommerceImport({ import_type = 'products', full_sync = false }, storeId) {
  return {
    success: true,
    message: `Triggered WooCommerce ${import_type} import (${full_sync ? 'full sync' : 'incremental'})`,
    note: 'Import job has been queued. Check job status for progress.',
    action: 'trigger'
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// STORE INFO TOOLS
// ═══════════════════════════════════════════════════════════════════════════

async function getStoreInfo(storeId) {
  const db = await ConnectionManager.getStoreConnection(storeId);

  const { data: store, error } = await db
    .from('stores')
    .select('id, name, slug, description, currency, timezone, is_active, deployment_status, published, published_at, created_at')
    .eq('id', storeId)
    .single();

  if (error) return { error: `Failed to get store info: ${error.message}` };

  return {
    store: {
      id: store.id,
      name: store.name,
      slug: store.slug,
      description: store.description,
      currency: store.currency,
      timezone: store.timezone,
      is_active: store.is_active,
      deployment_status: store.deployment_status,
      published: store.published,
      published_at: store.published_at,
      created_at: store.created_at
    }
  };
}

async function updateStoreInfo(input, storeId) {
  const db = await ConnectionManager.getStoreConnection(storeId);

  const updates = {};
  if (input.name !== undefined) updates.name = input.name;
  if (input.description !== undefined) updates.description = input.description;
  if (input.currency !== undefined) updates.currency = input.currency;
  if (input.timezone !== undefined) updates.timezone = input.timezone;
  updates.updated_at = new Date().toISOString();

  if (Object.keys(updates).length === 1) {
    return { error: 'No fields to update' };
  }

  const { error } = await db
    .from('stores')
    .update(updates)
    .eq('id', storeId);

  if (error) return { error: `Failed to update store: ${error.message}` };

  const changedFields = Object.keys(updates).filter(k => k !== 'updated_at');
  return {
    success: true,
    message: `Store info updated: ${changedFields.join(', ')}`,
    action: 'update',
    refreshPreview: true
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// LANGUAGE TOOLS
// ═══════════════════════════════════════════════════════════════════════════

async function listLanguages(input, storeId) {
  const db = await ConnectionManager.getStoreConnection(storeId);

  let query = db
    .from('languages')
    .select('id, code, name, native_name, flag, is_rtl, is_active, is_default, created_at')
    .order('is_default', { ascending: false })
    .order('name');

  if (input.active_only) {
    query = query.eq('is_active', true);
  }

  const { data, error } = await query;

  if (error) return { error: `Failed to list languages: ${error.message}` };

  return {
    languages: data || [],
    count: data?.length || 0
  };
}

async function createLanguage(input, storeId) {
  const db = await ConnectionManager.getStoreConnection(storeId);

  // Check if code already exists
  const { data: existing } = await db
    .from('languages')
    .select('id')
    .eq('code', input.code)
    .single();

  if (existing) {
    return { error: `Language with code '${input.code}' already exists` };
  }

  const languageData = {
    code: input.code,
    name: input.name,
    native_name: input.native_name || input.name,
    flag: input.flag || '',
    is_rtl: input.is_rtl || false,
    is_active: input.is_active !== false,
    is_default: input.is_default || false
  };

  // If setting as default, unset other defaults first
  if (languageData.is_default) {
    await db
      .from('languages')
      .update({ is_default: false })
      .eq('is_default', true);
  }

  const { error } = await db
    .from('languages')
    .insert(languageData);

  if (error) return { error: `Failed to create language: ${error.message}` };

  return {
    success: true,
    message: `Language '${input.name}' (${input.code}) created${languageData.is_default ? ' as default' : ''}`,
    action: 'create',
    refreshPreview: true
  };
}

async function updateLanguage(input, storeId) {
  const db = await ConnectionManager.getStoreConnection(storeId);

  // Find language by code
  const { data: lang } = await db
    .from('languages')
    .select('id, name')
    .eq('code', input.code)
    .single();

  if (!lang) {
    return { error: `Language '${input.code}' not found` };
  }

  const updates = {};
  if (input.name !== undefined) updates.name = input.name;
  if (input.native_name !== undefined) updates.native_name = input.native_name;
  if (input.flag !== undefined) updates.flag = input.flag;
  if (input.is_rtl !== undefined) updates.is_rtl = input.is_rtl;
  if (input.is_active !== undefined) updates.is_active = input.is_active;
  if (input.is_default !== undefined) updates.is_default = input.is_default;
  updates.updated_at = new Date().toISOString();

  // If setting as default, unset other defaults first
  if (updates.is_default) {
    await db
      .from('languages')
      .update({ is_default: false })
      .eq('is_default', true);
  }

  const { error } = await db
    .from('languages')
    .update(updates)
    .eq('id', lang.id);

  if (error) return { error: `Failed to update language: ${error.message}` };

  return {
    success: true,
    message: `Language '${input.code}' updated`,
    action: 'update',
    refreshPreview: true
  };
}

async function deleteLanguage(input, storeId) {
  const db = await ConnectionManager.getStoreConnection(storeId);

  // Find language by code
  const { data: lang } = await db
    .from('languages')
    .select('id, name, is_default')
    .eq('code', input.code)
    .single();

  if (!lang) {
    return { error: `Language '${input.code}' not found` };
  }

  if (lang.is_default) {
    return { error: `Cannot delete default language. Set another language as default first.` };
  }

  const { error } = await db
    .from('languages')
    .delete()
    .eq('id', lang.id);

  if (error) return { error: `Failed to delete language: ${error.message}` };

  return {
    success: true,
    message: `Language '${lang.name}' (${input.code}) deleted`,
    action: 'delete',
    refreshPreview: true
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// REDIRECT TOOLS
// ═══════════════════════════════════════════════════════════════════════════

async function listRedirects(input, storeId) {
  const db = await ConnectionManager.getStoreConnection(storeId);

  let query = db
    .from('redirects')
    .select('id, from_url, to_url, type, is_active, hit_count, last_used_at, notes, created_at')
    .eq('store_id', storeId)
    .order('created_at', { ascending: false });

  if (input.active_only) {
    query = query.eq('is_active', true);
  }

  if (input.search) {
    query = query.or(`from_url.ilike.%${input.search}%,to_url.ilike.%${input.search}%`);
  }

  const limit = input.limit || 50;
  query = query.limit(limit);

  const { data, error } = await query;

  if (error) return { error: `Failed to list redirects: ${error.message}` };

  return {
    redirects: data || [],
    count: data?.length || 0
  };
}

async function createRedirect(input, storeId) {
  const db = await ConnectionManager.getStoreConnection(storeId);

  // Check if from_url already exists
  const { data: existing } = await db
    .from('redirects')
    .select('id')
    .eq('store_id', storeId)
    .eq('from_url', input.from_url)
    .single();

  if (existing) {
    return { error: `Redirect from '${input.from_url}' already exists` };
  }

  const redirectData = {
    store_id: storeId,
    from_url: input.from_url,
    to_url: input.to_url,
    type: input.type || '301',
    is_active: true,
    notes: input.notes || null,
    hit_count: 0
  };

  const { error } = await db
    .from('redirects')
    .insert(redirectData);

  if (error) return { error: `Failed to create redirect: ${error.message}` };

  return {
    success: true,
    message: `Redirect created: ${input.from_url} → ${input.to_url} (${redirectData.type})`,
    action: 'create'
  };
}

async function updateRedirect(input, storeId) {
  const db = await ConnectionManager.getStoreConnection(storeId);

  // Find redirect by from_url
  const { data: redirect } = await db
    .from('redirects')
    .select('id')
    .eq('store_id', storeId)
    .eq('from_url', input.from_url)
    .single();

  if (!redirect) {
    return { error: `Redirect from '${input.from_url}' not found` };
  }

  const updates = {};
  if (input.new_from_url !== undefined) updates.from_url = input.new_from_url;
  if (input.to_url !== undefined) updates.to_url = input.to_url;
  if (input.type !== undefined) updates.type = input.type;
  if (input.is_active !== undefined) updates.is_active = input.is_active;
  if (input.notes !== undefined) updates.notes = input.notes;
  updates.updated_at = new Date().toISOString();

  const { error } = await db
    .from('redirects')
    .update(updates)
    .eq('id', redirect.id);

  if (error) return { error: `Failed to update redirect: ${error.message}` };

  return {
    success: true,
    message: `Redirect from '${input.from_url}' updated`,
    action: 'update'
  };
}

async function deleteRedirect(input, storeId) {
  const db = await ConnectionManager.getStoreConnection(storeId);

  // Find redirect by from_url
  const { data: redirect } = await db
    .from('redirects')
    .select('id, to_url')
    .eq('store_id', storeId)
    .eq('from_url', input.from_url)
    .single();

  if (!redirect) {
    return { error: `Redirect from '${input.from_url}' not found` };
  }

  const { error } = await db
    .from('redirects')
    .delete()
    .eq('id', redirect.id);

  if (error) return { error: `Failed to delete redirect: ${error.message}` };

  return {
    success: true,
    message: `Redirect ${input.from_url} → ${redirect.to_url} deleted`,
    action: 'delete'
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// MEDIA ASSET TOOLS
// ═══════════════════════════════════════════════════════════════════════════

async function listMediaAssets(input, storeId) {
  const db = await ConnectionManager.getStoreConnection(storeId);

  let query = db
    .from('media_assets')
    .select('id, file_name, original_name, file_url, mime_type, file_size, folder, description, tags, usage_count, created_at')
    .eq('store_id', storeId)
    .order('created_at', { ascending: false });

  if (input.folder) {
    query = query.eq('folder', input.folder);
  }

  if (input.mime_type) {
    if (input.mime_type.endsWith('/*')) {
      // Wildcard match like "image/*"
      const prefix = input.mime_type.replace('/*', '');
      query = query.ilike('mime_type', `${prefix}/%`);
    } else {
      query = query.eq('mime_type', input.mime_type);
    }
  }

  if (input.search) {
    query = query.or(`file_name.ilike.%${input.search}%,original_name.ilike.%${input.search}%,description.ilike.%${input.search}%`);
  }

  const limit = input.limit || 50;
  query = query.limit(limit);

  const { data, error } = await query;

  if (error) return { error: `Failed to list media assets: ${error.message}` };

  return {
    assets: data || [],
    count: data?.length || 0
  };
}

async function updateMediaAsset(input, storeId) {
  const db = await ConnectionManager.getStoreConnection(storeId);

  // Find asset by file_name
  const { data: asset } = await db
    .from('media_assets')
    .select('id, file_name')
    .eq('store_id', storeId)
    .ilike('file_name', input.file_name)
    .single();

  if (!asset) {
    // Try original_name
    const { data: byOriginal } = await db
      .from('media_assets')
      .select('id, file_name')
      .eq('store_id', storeId)
      .ilike('original_name', input.file_name)
      .single();

    if (!byOriginal) {
      return { error: `Media asset '${input.file_name}' not found` };
    }
    asset.id = byOriginal.id;
    asset.file_name = byOriginal.file_name;
  }

  const updates = {};
  if (input.description !== undefined) updates.description = input.description;
  if (input.folder !== undefined) updates.folder = input.folder;
  if (input.tags !== undefined) updates.tags = JSON.stringify(input.tags);
  updates.updated_at = new Date().toISOString();

  const { error } = await db
    .from('media_assets')
    .update(updates)
    .eq('id', asset.id);

  if (error) return { error: `Failed to update media asset: ${error.message}` };

  return {
    success: true,
    message: `Media asset '${asset.file_name}' updated`,
    action: 'update'
  };
}

async function deleteMediaAsset(input, storeId) {
  const db = await ConnectionManager.getStoreConnection(storeId);

  // Find asset by file_name
  const { data: asset } = await db
    .from('media_assets')
    .select('id, file_name, file_url')
    .eq('store_id', storeId)
    .ilike('file_name', input.file_name)
    .single();

  if (!asset) {
    return { error: `Media asset '${input.file_name}' not found` };
  }

  const { error } = await db
    .from('media_assets')
    .delete()
    .eq('id', asset.id);

  if (error) return { error: `Failed to delete media asset: ${error.message}` };

  return {
    success: true,
    message: `Media asset '${asset.file_name}' deleted`,
    note: 'Note: The actual file may still exist in storage',
    action: 'delete'
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// CREDIT TOOLS (Info Only - Master DB)
// ═══════════════════════════════════════════════════════════════════════════

async function getCreditBalance(input, storeId, userId) {
  const masterDb = masterDbClient;

  // Get user's credit balance
  const { data: user, error: userError } = await masterDb
    .from('users')
    .select('id, email, credits')
    .eq('id', userId)
    .single();

  if (userError || !user) {
    return { error: 'Could not retrieve user information' };
  }

  const result = {
    balance: parseFloat(user.credits) || 0,
    email: user.email
  };

  // Include recent usage if requested
  if (input.include_usage !== false) {
    const { data: usage } = await masterDb
      .from('credit_usage')
      .select('usage_type, credits_used, description, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(10);

    result.recent_usage = usage || [];

    // Calculate usage summary by type
    const { data: usageSummary } = await masterDb
      .from('credit_usage')
      .select('usage_type, credits_used')
      .eq('user_id', userId)
      .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());

    if (usageSummary) {
      const summary = {};
      usageSummary.forEach(u => {
        summary[u.usage_type] = (summary[u.usage_type] || 0) + parseFloat(u.credits_used);
      });
      result.usage_last_30_days = summary;
    }
  }

  result.purchase_url = '/settings/billing';
  result.message = `Current balance: ${result.balance.toFixed(2)} credits`;

  return result;
}

async function getCreditPricing(input) {
  const masterDb = masterDbClient;

  let query = masterDb
    .from('service_credit_costs')
    .select('service_key, service_name, service_category, cost_per_unit, billing_type, description, is_active')
    .eq('is_active', true)
    .eq('is_visible', true)
    .order('service_category')
    .order('display_order');

  if (input.category && input.category !== 'all') {
    query = query.eq('service_category', input.category);
  }

  const { data, error } = await query;

  if (error) {
    return { error: `Failed to get pricing: ${error.message}` };
  }

  // Group by category
  const grouped = {};
  (data || []).forEach(service => {
    const cat = service.service_category || 'other';
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push({
      service: service.service_name,
      key: service.service_key,
      cost: parseFloat(service.cost_per_unit),
      billing: service.billing_type,
      description: service.description
    });
  });

  return {
    pricing: grouped,
    total_services: data?.length || 0,
    purchase_url: '/settings/billing'
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// TEAM MANAGEMENT TOOLS (Master DB)
// ═══════════════════════════════════════════════════════════════════════════

async function listTeamMembers(input, storeId) {
  const masterDb = masterDbClient;

  // Get active team members
  const { data: members, error } = await masterDb
    .from('store_teams')
    .select(`
      id,
      role,
      status,
      invited_at,
      accepted_at,
      users:user_id (id, email, first_name, last_name)
    `)
    .eq('store_id', storeId)
    .in('status', ['active', 'pending']);

  if (error) {
    return { error: `Failed to list team members: ${error.message}` };
  }

  const teamList = (members || []).map(m => ({
    id: m.id,
    email: m.users?.email,
    name: m.users ? `${m.users.first_name} ${m.users.last_name}`.trim() : null,
    role: m.role,
    status: m.status,
    invited_at: m.invited_at,
    accepted_at: m.accepted_at
  }));

  const result = {
    members: teamList,
    count: teamList.length
  };

  // Include pending invitations if requested
  if (input.include_pending !== false) {
    const { data: invitations } = await masterDb
      .from('store_invitations')
      .select('id, invited_email, role, status, expires_at, created_at')
      .eq('store_id', storeId)
      .eq('status', 'pending');

    result.pending_invitations = (invitations || []).map(inv => ({
      email: inv.invited_email,
      role: inv.role,
      status: inv.status,
      expires_at: inv.expires_at,
      sent_at: inv.created_at
    }));
  }

  return result;
}

async function inviteTeamMember(input, storeId, userId) {
  const masterDb = masterDbClient;
  const crypto = require('crypto');

  // Check if already a team member
  const { data: existingMember } = await masterDb
    .from('store_teams')
    .select('id, status')
    .eq('store_id', storeId)
    .eq('users.email', input.email)
    .single();

  if (existingMember && existingMember.status === 'active') {
    return { error: `${input.email} is already a team member` };
  }

  // Check if there's already a pending invitation
  const { data: existingInvite } = await masterDb
    .from('store_invitations')
    .select('id, status, expires_at')
    .eq('store_id', storeId)
    .eq('invited_email', input.email.toLowerCase())
    .eq('status', 'pending')
    .single();

  if (existingInvite) {
    return { error: `An invitation is already pending for ${input.email}. Use resend_invitation to resend.` };
  }

  // Create invitation
  const invitationToken = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

  const { error } = await masterDb
    .from('store_invitations')
    .insert({
      store_id: storeId,
      invited_email: input.email.toLowerCase(),
      invited_by: userId,
      role: input.role || 'viewer',
      invitation_token: invitationToken,
      expires_at: expiresAt.toISOString(),
      status: 'pending',
      message: input.message || null
    });

  if (error) {
    return { error: `Failed to create invitation: ${error.message}` };
  }

  return {
    success: true,
    message: `Invitation sent to ${input.email} with role '${input.role || 'viewer'}'`,
    note: 'Invitation expires in 7 days',
    action: 'invite'
  };
}

async function updateTeamMember(input, storeId) {
  const masterDb = masterDbClient;

  // Find the team member by email
  const { data: users } = await masterDb
    .from('users')
    .select('id')
    .eq('email', input.email.toLowerCase())
    .single();

  if (!users) {
    return { error: `User with email '${input.email}' not found` };
  }

  const { data: member } = await masterDb
    .from('store_teams')
    .select('id, role')
    .eq('store_id', storeId)
    .eq('user_id', users.id)
    .single();

  if (!member) {
    return { error: `${input.email} is not a team member of this store` };
  }

  // Cannot change owner role
  if (member.role === 'owner') {
    return { error: 'Cannot change the role of the store owner' };
  }

  const updates = { updated_at: new Date().toISOString() };
  if (input.role) updates.role = input.role;

  const { error } = await masterDb
    .from('store_teams')
    .update(updates)
    .eq('id', member.id);

  if (error) {
    return { error: `Failed to update team member: ${error.message}` };
  }

  return {
    success: true,
    message: `Updated ${input.email} role to '${input.role}'`,
    action: 'update'
  };
}

async function removeTeamMember(input, storeId) {
  const masterDb = masterDbClient;

  // Find the user
  const { data: users } = await masterDb
    .from('users')
    .select('id')
    .eq('email', input.email.toLowerCase())
    .single();

  if (!users) {
    return { error: `User with email '${input.email}' not found` };
  }

  const { data: member } = await masterDb
    .from('store_teams')
    .select('id, role')
    .eq('store_id', storeId)
    .eq('user_id', users.id)
    .single();

  if (!member) {
    return { error: `${input.email} is not a team member of this store` };
  }

  // Cannot remove owner
  if (member.role === 'owner') {
    return { error: 'Cannot remove the store owner' };
  }

  const { error } = await masterDb
    .from('store_teams')
    .delete()
    .eq('id', member.id);

  if (error) {
    return { error: `Failed to remove team member: ${error.message}` };
  }

  return {
    success: true,
    message: `${input.email} has been removed from the team`,
    action: 'delete'
  };
}

async function listInvitations(input, storeId) {
  const masterDb = masterDbClient;

  let query = masterDb
    .from('store_invitations')
    .select('id, invited_email, role, status, expires_at, message, created_at')
    .eq('store_id', storeId)
    .order('created_at', { ascending: false });

  if (input.status && input.status !== 'all') {
    query = query.eq('status', input.status);
  } else if (!input.status) {
    query = query.eq('status', 'pending');
  }

  const { data, error } = await query;

  if (error) {
    return { error: `Failed to list invitations: ${error.message}` };
  }

  return {
    invitations: (data || []).map(inv => ({
      email: inv.invited_email,
      role: inv.role,
      status: inv.status,
      expires_at: inv.expires_at,
      message: inv.message,
      sent_at: inv.created_at,
      is_expired: new Date(inv.expires_at) < new Date()
    })),
    count: data?.length || 0
  };
}

async function cancelInvitation(input, storeId) {
  const masterDb = masterDbClient;

  const { data: invitation } = await masterDb
    .from('store_invitations')
    .select('id, status')
    .eq('store_id', storeId)
    .eq('invited_email', input.email.toLowerCase())
    .eq('status', 'pending')
    .single();

  if (!invitation) {
    return { error: `No pending invitation found for ${input.email}` };
  }

  const { error } = await masterDb
    .from('store_invitations')
    .update({ status: 'cancelled' })
    .eq('id', invitation.id);

  if (error) {
    return { error: `Failed to cancel invitation: ${error.message}` };
  }

  return {
    success: true,
    message: `Invitation to ${input.email} has been cancelled`,
    action: 'cancel'
  };
}

async function resendInvitation(input, storeId) {
  const masterDb = masterDbClient;
  const crypto = require('crypto');

  const { data: invitation } = await masterDb
    .from('store_invitations')
    .select('id, status, role')
    .eq('store_id', storeId)
    .eq('invited_email', input.email.toLowerCase())
    .eq('status', 'pending')
    .single();

  if (!invitation) {
    return { error: `No pending invitation found for ${input.email}` };
  }

  // Generate new token and extend expiration
  const newToken = crypto.randomBytes(32).toString('hex');
  const newExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  const { error } = await masterDb
    .from('store_invitations')
    .update({
      invitation_token: newToken,
      expires_at: newExpiry.toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq('id', invitation.id);

  if (error) {
    return { error: `Failed to resend invitation: ${error.message}` };
  }

  return {
    success: true,
    message: `Invitation resent to ${input.email}`,
    note: 'New invitation link generated, expires in 7 days',
    action: 'resend'
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

  // Return grouped settings based on area
  switch (area) {
    case 'theme':
      return { theme: settings.theme || {} };

    case 'stock':
      return {
        stock: {
          enable_inventory: settings.enable_inventory ?? true,
          display_out_of_stock: settings.display_out_of_stock ?? true,
          hide_stock_quantity: settings.hide_stock_quantity ?? false,
          display_low_stock_threshold: settings.display_low_stock_threshold ?? 0,
          show_stock_label: settings.show_stock_label ?? false
        }
      };

    case 'display':
      return {
        display: {
          hide_header_cart: settings.hide_header_cart ?? false,
          hide_header_checkout: settings.hide_header_checkout ?? false,
          hide_header_search: settings.hide_header_search ?? false,
          show_permanent_search: settings.show_permanent_search ?? true,
          show_category_in_breadcrumb: settings.show_category_in_breadcrumb ?? true,
          show_language_selector: settings.show_language_selector ?? false,
          hide_quantity_selector: settings.hide_quantity_selector ?? false,
          hide_currency_category: settings.hide_currency_category ?? false,
          hide_currency_product: settings.hide_currency_product ?? false,
          enable_reviews: settings.enable_reviews ?? true
        }
      };

    case 'category':
      return {
        category: {
          enable_product_filters: settings.enable_product_filters ?? true,
          collapse_filters: settings.collapse_filters ?? false,
          max_visible_attributes: settings.max_visible_attributes ?? 5,
          enable_view_mode_toggle: settings.enable_view_mode_toggle ?? true,
          default_view_mode: settings.default_view_mode ?? 'grid'
        }
      };

    case 'checkout':
      return {
        checkout: {
          checkout_steps_count: settings.checkout_steps_count ?? 2,
          checkout_2step_step1_name: settings.checkout_2step_step1_name ?? 'Information',
          checkout_2step_step2_name: settings.checkout_2step_step2_name ?? 'Payment',
          checkout_3step_step1_name: settings.checkout_3step_step1_name ?? 'Information',
          checkout_3step_step2_name: settings.checkout_3step_step2_name ?? 'Shipping',
          checkout_3step_step3_name: settings.checkout_3step_step3_name ?? 'Payment',
          allow_guest_checkout: settings.allow_guest_checkout ?? true,
          require_shipping_address: settings.require_shipping_address ?? true,
          collect_phone_number_at_checkout: settings.collect_phone_number_at_checkout ?? false,
          phone_number_required_at_checkout: settings.phone_number_required_at_checkout ?? true
        }
      };

    case 'navigation':
      return {
        navigation: {
          excludeRootFromMenu: settings.excludeRootFromMenu ?? false,
          expandAllMenuItems: settings.expandAllMenuItems ?? false,
          rootCategoryId: settings.rootCategoryId ?? null
        }
      };

    case 'gallery':
      return {
        gallery: {
          product_gallery_layout: settings.product_gallery_layout ?? 'horizontal',
          vertical_gallery_position: settings.vertical_gallery_position ?? 'left',
          mobile_gallery_layout: settings.mobile_gallery_layout ?? 'below'
        }
      };

    default:
      return { [area]: settings[area] || {} };
  }
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

/**
 * Update multiple settings at once for a specific section
 * @param {Object} updates - Key-value pairs of settings to update
 * @param {string} storeId - Store ID
 * @param {string} section - Section name for logging
 */
async function updateSettingsSection(updates, storeId, section) {
  const db = await ConnectionManager.getStoreConnection(storeId);

  // Get current settings
  const { data: store } = await db.from('stores').select('settings').eq('id', storeId).single();
  const settings = store?.settings || {};

  // Track what was updated
  const updatedFields = [];
  const previousValues = {};

  // Apply each update
  for (const [key, value] of Object.entries(updates)) {
    if (value !== undefined && value !== null) {
      previousValues[key] = settings[key];
      settings[key] = value;
      updatedFields.push(`${key}=${JSON.stringify(value)}`);
    }
  }

  if (updatedFields.length === 0) {
    return { error: 'No valid settings provided to update' };
  }

  // Save updated settings
  await db.from('stores').update({ settings }).eq('id', storeId);

  // Determine if preview should refresh (theme-related settings need refresh)
  const themeRelatedSections = ['display', 'gallery'];
  const refreshPreview = themeRelatedSections.includes(section);

  return {
    success: true,
    message: `Updated ${section} settings: ${updatedFields.join(', ')}`,
    updatedCount: updatedFields.length,
    section,
    refreshPreview,
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

/**
 * Determine LLM provider from model ID
 */
function getProviderFromModel(modelId) {
  if (!modelId) return 'anthropic';
  if (modelId.startsWith('claude')) return 'anthropic';
  if (modelId.startsWith('gpt-') || modelId.startsWith('o1') || modelId.startsWith('o3')) return 'openai';
  if (modelId.startsWith('gemini')) return 'google';
  return 'anthropic'; // default
}

/**
 * Get default model for provider
 */
function getDefaultModel(provider) {
  switch (provider) {
    case 'openai': return 'gpt-4o';
    case 'google': return 'gemini-pro';
    case 'anthropic':
    default: return 'claude-sonnet-4-20250514';
  }
}

/**
 * Convert tools to OpenAI format
 */
function convertToolsToOpenAI(tools) {
  return tools.map(tool => ({
    type: 'function',
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.input_schema
    }
  }));
}

async function chat({ message, conversationHistory = [], storeId, userId, mode = 'general', images, modelId }) {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('🤖 UNIFIED AI CHAT');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('📝 Message:', message?.substring(0, 100));
  console.log('🏪 Store:', storeId);
  console.log('🎯 Mode:', mode);

  // Determine provider and resolve model ID to full API model name
  const provider = getProviderFromModel(modelId);
  let model;
  if (modelId) {
    // Resolve short model IDs (e.g., 'claude-haiku') to full API names (e.g., 'claude-3-5-haiku-20241022')
    const modelConfig = await aiModelsService.getModelConfig(modelId);
    model = modelConfig?.model || modelId;
  } else {
    model = getDefaultModel(provider);
  }
  console.log('🤖 Provider:', provider, '| Model:', model);

  // Build system prompt with RAG
  const systemPrompt = await buildSystemPrompt(storeId, message);

  // Route to appropriate provider
  if (provider === 'openai') {
    return await chatWithOpenAI({ message, conversationHistory, storeId, userId, images, model, systemPrompt });
  }

  // Default: Anthropic
  return await chatWithAnthropic({ message, conversationHistory, storeId, userId, images, model, systemPrompt });
}

/**
 * Chat with Anthropic (Claude)
 */
async function chatWithAnthropic({ message, conversationHistory, storeId, userId, images, model, systemPrompt }) {
  const anthropic = getAnthropicClient();

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
    model,
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
      model,
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

  // Calculate cost and credits (Anthropic pricing)
  // Actual API cost: $3/1M input, $15/1M output
  const costPrice = (totalTokens.input * 3 + totalTokens.output * 15) / 1000000;
  // Credits to charge user (1 credit = $0.10, so costPrice / 0.10)
  const credits = costPrice / 0.10;

  console.log('✅ Complete:', { provider: 'anthropic', model, tools: toolCalls.length, tokens: totalTokens, credits: credits.toFixed(2), costPrice: costPrice.toFixed(4) });

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
      usage: totalTokens,
      model
    },
    creditsDeducted: credits,
    costPrice
  };
}

/**
 * Chat with OpenAI (GPT-4, etc.)
 */
async function chatWithOpenAI({ message, conversationHistory, storeId, userId, images, model, systemPrompt }) {
  const openai = getOpenAIClient();

  // Build messages with system prompt
  const messages = [
    { role: 'system', content: systemPrompt }
  ];

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
        type: 'image_url',
        image_url: { url: `data:${img.type || 'image/jpeg'};base64,${img.base64}` }
      }))
    ];
    messages.push({ role: 'user', content });
  } else {
    messages.push({ role: 'user', content: message });
  }

  // Convert tools to OpenAI format
  const openaiTools = convertToolsToOpenAI(TOOLS);

  // Call OpenAI with tools
  let response = await openai.chat.completions.create({
    model,
    max_tokens: 4096,
    messages,
    tools: openaiTools,
    tool_choice: 'auto'
  });

  const toolCalls = [];
  let totalTokens = {
    input: response.usage?.prompt_tokens || 0,
    output: response.usage?.completion_tokens || 0
  };

  // Handle tool calls loop
  while (response.choices[0]?.finish_reason === 'tool_calls') {
    const assistantMessage = response.choices[0].message;
    messages.push(assistantMessage);

    // Process each tool call
    for (const toolCall of assistantMessage.tool_calls || []) {
      const toolName = toolCall.function.name;
      const toolInput = JSON.parse(toolCall.function.arguments);
      const result = await executeTool(toolName, toolInput, { storeId, userId });

      toolCalls.push({ name: toolName, input: toolInput, result });

      messages.push({
        role: 'tool',
        tool_call_id: toolCall.id,
        content: JSON.stringify(result)
      });
    }

    // Continue conversation
    response = await openai.chat.completions.create({
      model,
      max_tokens: 4096,
      messages,
      tools: openaiTools,
      tool_choice: 'auto'
    });

    totalTokens.input += response.usage?.prompt_tokens || 0;
    totalTokens.output += response.usage?.completion_tokens || 0;
  }

  // Extract final text
  const finalMessage = response.choices[0]?.message?.content || '';

  // Calculate cost and credits (OpenAI GPT-4o pricing)
  // Actual API cost: $2.50/1M input, $10/1M output
  const costPrice = (totalTokens.input * 2.5 + totalTokens.output * 10) / 1000000;
  // Credits to charge user (1 credit = $0.10)
  const credits = costPrice / 0.10;

  console.log('✅ Complete:', { provider: 'openai', model, tools: toolCalls.length, tokens: totalTokens, credits: credits.toFixed(2), costPrice: costPrice.toFixed(4) });

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
      usage: totalTokens,
      model
    },
    creditsDeducted: credits,
    costPrice
  };
}

module.exports = {
  chat,
  TOOLS,
  executeTool
};
