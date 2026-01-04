/**
 * Store Editing Service
 *
 * Provides AI-powered store editing through LLM function calling.
 * No model training required - uses tool definitions that the AI can call.
 *
 * ARCHITECTURE:
 * 1. User sends natural language command ("Change the product title to green")
 * 2. AI receives tools definitions and decides which to call
 * 3. AI returns tool_use with parameters
 * 4. Backend executes the tool against database/config
 * 5. Result returned to AI for response generation
 *
 * USAGE:
 * const storeEditingService = require('./storeEditingService');
 * const tools = storeEditingService.getTools();
 * const result = await storeEditingService.executeTool(toolName, toolInput, storeId);
 */

const ConnectionManager = require('./database/ConnectionManager');

class StoreEditingService {
  constructor() {
    // Element selector mappings for natural language to CSS/config
    this.elementMappings = {
      // Product page elements
      'product-title': { selector: '.product-title', configKey: 'product_title' },
      'product-price': { selector: '.product-price', configKey: 'product_price' },
      'product-description': { selector: '.product-description', configKey: 'product_description' },
      'product-sku': { selector: '.product-sku', configKey: 'product_sku' },
      'add-to-cart': { selector: '.add-to-cart-btn', configKey: 'add_to_cart_button' },
      'product-gallery': { selector: '.product-gallery', configKey: 'product_gallery' },

      // Category page elements
      'category-title': { selector: '.category-title', configKey: 'category_title' },
      'category-description': { selector: '.category-description', configKey: 'category_description' },
      'product-grid': { selector: '.product-grid', configKey: 'product_grid' },
      'product-card': { selector: '.product-card', configKey: 'product_card' },

      // Header elements
      'header': { selector: 'header', configKey: 'header' },
      'logo': { selector: '.store-logo', configKey: 'store_logo' },
      'navigation': { selector: '.main-nav', configKey: 'navigation' },
      'mega-menu': { selector: '.mega-menu', configKey: 'mega_menu' },
      'search-bar': { selector: '.search-bar', configKey: 'search_bar' },
      'cart-icon': { selector: '.cart-icon', configKey: 'cart_icon' },

      // Footer elements
      'footer': { selector: 'footer', configKey: 'footer' },

      // General elements
      'button': { selector: 'button', configKey: 'buttons' },
      'heading': { selector: 'h1, h2, h3', configKey: 'headings' },
      'link': { selector: 'a', configKey: 'links' }
    };
  }

  /**
   * Get all store editing tools for AI function calling
   * These tools define what the AI can do to modify the store
   */
  getTools() {
    return [
      // STYLING TOOLS
      {
        name: 'update_element_style',
        description: 'Change the visual styling (CSS) of a store element. Use this for color changes, font sizes, spacing, backgrounds, borders, etc. Examples: "make the product title green", "increase button font size", "add padding to the header"',
        input_schema: {
          type: 'object',
          properties: {
            element: {
              type: 'string',
              description: 'The element to style. Options: product-title, product-price, product-description, add-to-cart, header, logo, navigation, footer, button, heading, link, product-card, category-title'
            },
            styles: {
              type: 'object',
              description: 'CSS properties to apply as key-value pairs',
              properties: {
                color: { type: 'string', description: 'Text color (e.g., "green", "#00ff00", "rgb(0,255,0)")' },
                backgroundColor: { type: 'string', description: 'Background color' },
                fontSize: { type: 'string', description: 'Font size (e.g., "16px", "1.2rem", "larger")' },
                fontWeight: { type: 'string', description: 'Font weight (e.g., "bold", "600", "normal")' },
                padding: { type: 'string', description: 'Padding (e.g., "10px", "1rem 2rem")' },
                margin: { type: 'string', description: 'Margin (e.g., "10px", "1rem 0")' },
                borderRadius: { type: 'string', description: 'Border radius (e.g., "5px", "50%")' },
                border: { type: 'string', description: 'Border (e.g., "1px solid #ccc")' },
                textAlign: { type: 'string', description: 'Text alignment (left, center, right)' },
                textTransform: { type: 'string', description: 'Text transform (uppercase, lowercase, capitalize)' }
              }
            },
            pageType: {
              type: 'string',
              description: 'Which page type this applies to (product, category, cart, checkout, homepage, all)',
              enum: ['product', 'category', 'cart', 'checkout', 'homepage', 'all']
            }
          },
          required: ['element', 'styles']
        }
      },

      // LAYOUT/SLOT TOOLS
      {
        name: 'add_slot',
        description: 'Add a new content slot/section to the page. Use for adding banners, text sections, image blocks, or custom content areas.',
        input_schema: {
          type: 'object',
          properties: {
            pageType: {
              type: 'string',
              description: 'Which page to add the slot to',
              enum: ['product', 'category', 'cart', 'checkout', 'homepage', 'header', 'footer']
            },
            slotType: {
              type: 'string',
              description: 'Type of slot to add',
              enum: ['text', 'html', 'image', 'banner', 'container', 'button', 'divider', 'spacer']
            },
            position: {
              type: 'string',
              description: 'Where to place the slot',
              enum: ['top', 'bottom', 'before-content', 'after-content', 'sidebar']
            },
            content: {
              type: 'string',
              description: 'Initial content for the slot (text, HTML, or image URL)'
            },
            styles: {
              type: 'object',
              description: 'Optional CSS styles for the slot'
            },
            width: {
              type: 'string',
              description: 'Width of the slot (full, half, third, quarter, or specific like "300px")',
              enum: ['full', 'half', 'third', 'quarter']
            }
          },
          required: ['pageType', 'slotType', 'position']
        }
      },

      {
        name: 'remove_slot',
        description: 'Remove an existing slot/section from the page.',
        input_schema: {
          type: 'object',
          properties: {
            slotId: {
              type: 'string',
              description: 'The ID of the slot to remove'
            },
            pageType: {
              type: 'string',
              description: 'Which page the slot is on',
              enum: ['product', 'category', 'cart', 'checkout', 'homepage', 'header', 'footer']
            }
          },
          required: ['slotId', 'pageType']
        }
      },

      {
        name: 'move_slot',
        description: 'Move a slot to a different position on the page.',
        input_schema: {
          type: 'object',
          properties: {
            slotId: {
              type: 'string',
              description: 'The ID of the slot to move'
            },
            targetPosition: {
              type: 'string',
              description: 'Where to move the slot',
              enum: ['top', 'bottom', 'before', 'after']
            },
            referenceSlotId: {
              type: 'string',
              description: 'If using before/after, the slot to position relative to'
            },
            pageType: {
              type: 'string',
              description: 'Which page the slot is on'
            }
          },
          required: ['slotId', 'targetPosition', 'pageType']
        }
      },

      // MEGA MENU TOOLS
      {
        name: 'add_mega_menu_slot',
        description: 'Add a mega menu slot to the navigation. Mega menus display rich content like category grids, featured products, or promotional content.',
        input_schema: {
          type: 'object',
          properties: {
            title: {
              type: 'string',
              description: 'Menu title displayed in navigation'
            },
            menuType: {
              type: 'string',
              description: 'Type of mega menu content',
              enum: ['categories', 'featured-products', 'brands', 'promotional', 'custom-html']
            },
            position: {
              type: 'number',
              description: 'Position in the navigation (0 = first)'
            },
            content: {
              type: 'object',
              description: 'Content configuration for the mega menu',
              properties: {
                categoryIds: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Category IDs to display (for categories type)'
                },
                productIds: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Product IDs to feature (for featured-products type)'
                },
                columns: {
                  type: 'number',
                  description: 'Number of columns in the mega menu (2-6)'
                },
                showImages: {
                  type: 'boolean',
                  description: 'Whether to show images in the menu'
                },
                customHtml: {
                  type: 'string',
                  description: 'Custom HTML content (for custom-html type)'
                }
              }
            },
            styles: {
              type: 'object',
              description: 'Custom styles for the mega menu'
            }
          },
          required: ['title', 'menuType']
        }
      },

      {
        name: 'update_mega_menu',
        description: 'Update an existing mega menu slot configuration.',
        input_schema: {
          type: 'object',
          properties: {
            menuId: {
              type: 'string',
              description: 'ID of the mega menu to update'
            },
            title: {
              type: 'string',
              description: 'New menu title'
            },
            content: {
              type: 'object',
              description: 'Updated content configuration'
            },
            enabled: {
              type: 'boolean',
              description: 'Enable or disable the mega menu'
            }
          },
          required: ['menuId']
        }
      },

      {
        name: 'remove_mega_menu',
        description: 'Remove a mega menu slot from navigation.',
        input_schema: {
          type: 'object',
          properties: {
            menuId: {
              type: 'string',
              description: 'ID of the mega menu to remove'
            }
          },
          required: ['menuId']
        }
      },

      // CONTENT TOOLS
      {
        name: 'update_content',
        description: 'Update text or HTML content of a slot or element.',
        input_schema: {
          type: 'object',
          properties: {
            slotId: {
              type: 'string',
              description: 'ID of the slot or element to update'
            },
            content: {
              type: 'string',
              description: 'New text or HTML content'
            },
            pageType: {
              type: 'string',
              description: 'Which page the content is on'
            }
          },
          required: ['slotId', 'content']
        }
      },

      // VISIBILITY TOOLS
      {
        name: 'toggle_element_visibility',
        description: 'Show or hide a store element/component. Use this to enable or disable features.',
        input_schema: {
          type: 'object',
          properties: {
            element: {
              type: 'string',
              description: 'The element to show/hide',
              enum: ['product-sku', 'product-gallery', 'related-products', 'reviews', 'breadcrumbs',
                     'filters', 'sorting', 'pagination', 'search-bar', 'cart-icon', 'wishlist',
                     'compare', 'social-share', 'stock-status', 'quantity-selector']
            },
            visible: {
              type: 'boolean',
              description: 'true to show, false to hide'
            },
            pageType: {
              type: 'string',
              description: 'Which page this applies to (or "all" for global)'
            }
          },
          required: ['element', 'visible']
        }
      },

      // THEME TOOLS
      {
        name: 'update_theme_colors',
        description: 'Update the store\'s theme color scheme. Affects primary colors, backgrounds, text colors across the entire store.',
        input_schema: {
          type: 'object',
          properties: {
            primaryColor: {
              type: 'string',
              description: 'Primary brand color (buttons, links, highlights)'
            },
            secondaryColor: {
              type: 'string',
              description: 'Secondary brand color (accents, hover states)'
            },
            backgroundColor: {
              type: 'string',
              description: 'Main background color'
            },
            textColor: {
              type: 'string',
              description: 'Primary text color'
            },
            headerBackground: {
              type: 'string',
              description: 'Header background color'
            },
            footerBackground: {
              type: 'string',
              description: 'Footer background color'
            }
          }
        }
      },

      // QUERY TOOLS (for AI to understand current state)
      {
        name: 'get_current_layout',
        description: 'Get the current layout configuration for a page. Use this to understand what slots exist before making changes.',
        input_schema: {
          type: 'object',
          properties: {
            pageType: {
              type: 'string',
              description: 'Which page layout to retrieve',
              enum: ['product', 'category', 'cart', 'checkout', 'homepage', 'header', 'footer']
            }
          },
          required: ['pageType']
        }
      },

      {
        name: 'get_mega_menus',
        description: 'Get all configured mega menu slots. Use this to see what mega menus exist before adding or modifying.',
        input_schema: {
          type: 'object',
          properties: {}
        }
      },

      {
        name: 'get_theme_settings',
        description: 'Get current theme settings including colors, fonts, and global styles.',
        input_schema: {
          type: 'object',
          properties: {}
        }
      }
    ];
  }

  /**
   * Execute a tool called by the AI
   * @param {string} toolName - Name of the tool to execute
   * @param {Object} toolInput - Parameters for the tool
   * @param {string} storeId - Store ID for tenant isolation
   * @returns {Promise<Object>} Tool execution result
   */
  async executeTool(toolName, toolInput, storeId) {
    console.log(`🔧 Executing store editing tool: ${toolName}`);
    console.log(`   Input:`, JSON.stringify(toolInput, null, 2));

    try {
      switch (toolName) {
        case 'update_element_style':
          return await this._executeUpdateElementStyle(toolInput, storeId);

        case 'add_slot':
          return await this._executeAddSlot(toolInput, storeId);

        case 'remove_slot':
          return await this._executeRemoveSlot(toolInput, storeId);

        case 'move_slot':
          return await this._executeMoveSlot(toolInput, storeId);

        case 'add_mega_menu_slot':
          return await this._executeAddMegaMenu(toolInput, storeId);

        case 'update_mega_menu':
          return await this._executeUpdateMegaMenu(toolInput, storeId);

        case 'remove_mega_menu':
          return await this._executeRemoveMegaMenu(toolInput, storeId);

        case 'update_content':
          return await this._executeUpdateContent(toolInput, storeId);

        case 'toggle_element_visibility':
          return await this._executeToggleVisibility(toolInput, storeId);

        case 'update_theme_colors':
          return await this._executeUpdateThemeColors(toolInput, storeId);

        case 'get_current_layout':
          return await this._executeGetCurrentLayout(toolInput, storeId);

        case 'get_mega_menus':
          return await this._executeGetMegaMenus(storeId);

        case 'get_theme_settings':
          return await this._executeGetThemeSettings(storeId);

        default:
          return {
            success: false,
            error: `Unknown tool: ${toolName}`
          };
      }
    } catch (error) {
      console.error(`❌ Tool execution error (${toolName}):`, error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // ============================================
  // TOOL EXECUTION IMPLEMENTATIONS
  // ============================================

  /**
   * Update element styling
   */
  async _executeUpdateElementStyle({ element, styles, pageType = 'all' }, storeId) {
    const tenantDb = await ConnectionManager.getStoreConnection(storeId);

    // Get element mapping
    const mapping = this.elementMappings[element];
    if (!mapping) {
      return {
        success: false,
        error: `Unknown element: ${element}. Available elements: ${Object.keys(this.elementMappings).join(', ')}`
      };
    }

    // Convert styles object to CSS string
    const cssStyles = Object.entries(styles)
      .map(([prop, value]) => {
        // Convert camelCase to kebab-case
        const kebabProp = prop.replace(/([A-Z])/g, '-$1').toLowerCase();
        return `${kebabProp}: ${value}`;
      })
      .join('; ');

    // Store in layout_config table
    const configKey = `${mapping.configKey}_styles`;
    const configValue = {
      selector: mapping.selector,
      styles,
      cssString: cssStyles,
      pageType,
      updatedAt: new Date().toISOString()
    };

    // Upsert the configuration
    await tenantDb('layout_config')
      .insert({
        store_id: storeId,
        config_key: configKey,
        config_value: JSON.stringify(configValue),
        page_type: pageType,
        created_at: new Date(),
        updated_at: new Date()
      })
      .onConflict(['store_id', 'config_key', 'page_type'])
      .merge({
        config_value: JSON.stringify(configValue),
        updated_at: new Date()
      });

    return {
      success: true,
      message: `Updated ${element} styling`,
      changes: {
        element,
        selector: mapping.selector,
        styles,
        pageType
      },
      refreshPreview: true
    };
  }

  /**
   * Add a new slot to the page
   */
  async _executeAddSlot({ pageType, slotType, position, content, styles, width }, storeId) {
    const tenantDb = await ConnectionManager.getStoreConnection(storeId);

    // Generate unique slot ID
    const slotId = `slot_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Convert width to column span
    const colSpanMap = { full: 12, half: 6, third: 4, quarter: 3 };
    const colSpan = colSpanMap[width] || 12;

    // Get current max row for position calculation
    const existingSlots = await tenantDb('page_slots')
      .where({ store_id: storeId, page_type: pageType })
      .orderBy('row_position', 'desc')
      .first();

    let rowPosition = 0;
    if (position === 'top') {
      // Shift all existing slots down
      await tenantDb('page_slots')
        .where({ store_id: storeId, page_type: pageType })
        .increment('row_position', 1);
      rowPosition = 0;
    } else if (position === 'bottom' || position === 'after-content') {
      rowPosition = (existingSlots?.row_position || 0) + 1;
    } else {
      rowPosition = existingSlots?.row_position || 0;
    }

    // Insert the new slot
    await tenantDb('page_slots').insert({
      store_id: storeId,
      slot_id: slotId,
      page_type: pageType,
      slot_type: slotType,
      content: content || '',
      styles: JSON.stringify(styles || {}),
      col_span: colSpan,
      row_span: 1,
      col_position: 1,
      row_position: rowPosition,
      is_visible: true,
      created_at: new Date(),
      updated_at: new Date()
    });

    return {
      success: true,
      message: `Added new ${slotType} slot to ${pageType} page`,
      slotId,
      changes: {
        slotId,
        pageType,
        slotType,
        position,
        colSpan
      },
      refreshPreview: true
    };
  }

  /**
   * Remove a slot from the page
   */
  async _executeRemoveSlot({ slotId, pageType }, storeId) {
    const tenantDb = await ConnectionManager.getStoreConnection(storeId);

    const deleted = await tenantDb('page_slots')
      .where({ store_id: storeId, slot_id: slotId, page_type: pageType })
      .delete();

    if (deleted === 0) {
      return {
        success: false,
        error: `Slot not found: ${slotId}`
      };
    }

    return {
      success: true,
      message: `Removed slot ${slotId} from ${pageType} page`,
      changes: { slotId, pageType },
      refreshPreview: true
    };
  }

  /**
   * Move a slot to a different position
   */
  async _executeMoveSlot({ slotId, targetPosition, referenceSlotId, pageType }, storeId) {
    const tenantDb = await ConnectionManager.getStoreConnection(storeId);

    // Get the slot to move
    const slot = await tenantDb('page_slots')
      .where({ store_id: storeId, slot_id: slotId, page_type: pageType })
      .first();

    if (!slot) {
      return {
        success: false,
        error: `Slot not found: ${slotId}`
      };
    }

    let newRowPosition;

    if (targetPosition === 'top') {
      newRowPosition = 0;
      // Shift all other slots down
      await tenantDb('page_slots')
        .where({ store_id: storeId, page_type: pageType })
        .whereNot('slot_id', slotId)
        .increment('row_position', 1);
    } else if (targetPosition === 'bottom') {
      const maxRow = await tenantDb('page_slots')
        .where({ store_id: storeId, page_type: pageType })
        .max('row_position as max')
        .first();
      newRowPosition = (maxRow?.max || 0) + 1;
    } else if (referenceSlotId) {
      const refSlot = await tenantDb('page_slots')
        .where({ store_id: storeId, slot_id: referenceSlotId })
        .first();

      if (!refSlot) {
        return {
          success: false,
          error: `Reference slot not found: ${referenceSlotId}`
        };
      }

      newRowPosition = targetPosition === 'before'
        ? refSlot.row_position
        : refSlot.row_position + 1;

      // Shift slots at or after the new position
      await tenantDb('page_slots')
        .where({ store_id: storeId, page_type: pageType })
        .where('row_position', '>=', newRowPosition)
        .whereNot('slot_id', slotId)
        .increment('row_position', 1);
    }

    // Update the slot position
    await tenantDb('page_slots')
      .where({ store_id: storeId, slot_id: slotId })
      .update({
        row_position: newRowPosition,
        updated_at: new Date()
      });

    return {
      success: true,
      message: `Moved slot ${slotId} to ${targetPosition}${referenceSlotId ? ` ${referenceSlotId}` : ''}`,
      changes: { slotId, newPosition: newRowPosition },
      refreshPreview: true
    };
  }

  /**
   * Add a mega menu slot
   */
  async _executeAddMegaMenu({ title, menuType, position = 0, content = {}, styles = {} }, storeId) {
    const tenantDb = await ConnectionManager.getStoreConnection(storeId);

    const menuId = `mega_menu_${Date.now()}`;

    // Set default content based on menu type
    const defaultContent = {
      columns: content.columns || 4,
      showImages: content.showImages !== false,
      ...content
    };

    await tenantDb('mega_menus').insert({
      store_id: storeId,
      menu_id: menuId,
      title,
      menu_type: menuType,
      position,
      content: JSON.stringify(defaultContent),
      styles: JSON.stringify(styles),
      is_enabled: true,
      created_at: new Date(),
      updated_at: new Date()
    });

    return {
      success: true,
      message: `Added mega menu "${title}" with ${menuType} content`,
      menuId,
      changes: {
        menuId,
        title,
        menuType,
        position
      },
      refreshPreview: true
    };
  }

  /**
   * Update a mega menu
   */
  async _executeUpdateMegaMenu({ menuId, title, content, enabled }, storeId) {
    const tenantDb = await ConnectionManager.getStoreConnection(storeId);

    const updates = { updated_at: new Date() };
    if (title !== undefined) updates.title = title;
    if (content !== undefined) updates.content = JSON.stringify(content);
    if (enabled !== undefined) updates.is_enabled = enabled;

    const updated = await tenantDb('mega_menus')
      .where({ store_id: storeId, menu_id: menuId })
      .update(updates);

    if (updated === 0) {
      return {
        success: false,
        error: `Mega menu not found: ${menuId}`
      };
    }

    return {
      success: true,
      message: `Updated mega menu ${menuId}`,
      changes: updates,
      refreshPreview: true
    };
  }

  /**
   * Remove a mega menu
   */
  async _executeRemoveMegaMenu({ menuId }, storeId) {
    const tenantDb = await ConnectionManager.getStoreConnection(storeId);

    const deleted = await tenantDb('mega_menus')
      .where({ store_id: storeId, menu_id: menuId })
      .delete();

    if (deleted === 0) {
      return {
        success: false,
        error: `Mega menu not found: ${menuId}`
      };
    }

    return {
      success: true,
      message: `Removed mega menu ${menuId}`,
      refreshPreview: true
    };
  }

  /**
   * Update slot content
   */
  async _executeUpdateContent({ slotId, content, pageType }, storeId) {
    const tenantDb = await ConnectionManager.getStoreConnection(storeId);

    const query = tenantDb('page_slots')
      .where({ store_id: storeId, slot_id: slotId });

    if (pageType) {
      query.where('page_type', pageType);
    }

    const updated = await query.update({
      content,
      updated_at: new Date()
    });

    if (updated === 0) {
      return {
        success: false,
        error: `Slot not found: ${slotId}`
      };
    }

    return {
      success: true,
      message: `Updated content for slot ${slotId}`,
      changes: { slotId, contentLength: content.length },
      refreshPreview: true
    };
  }

  /**
   * Toggle element visibility
   */
  async _executeToggleVisibility({ element, visible, pageType = 'all' }, storeId) {
    const tenantDb = await ConnectionManager.getStoreConnection(storeId);

    const configKey = `${element}_visibility`;
    const configValue = {
      element,
      visible,
      pageType,
      updatedAt: new Date().toISOString()
    };

    await tenantDb('layout_config')
      .insert({
        store_id: storeId,
        config_key: configKey,
        config_value: JSON.stringify(configValue),
        page_type: pageType,
        created_at: new Date(),
        updated_at: new Date()
      })
      .onConflict(['store_id', 'config_key', 'page_type'])
      .merge({
        config_value: JSON.stringify(configValue),
        updated_at: new Date()
      });

    return {
      success: true,
      message: `${visible ? 'Showing' : 'Hiding'} ${element}${pageType !== 'all' ? ` on ${pageType} page` : ''}`,
      changes: { element, visible, pageType },
      refreshPreview: true
    };
  }

  /**
   * Update theme colors
   */
  async _executeUpdateThemeColors(colors, storeId) {
    const tenantDb = await ConnectionManager.getStoreConnection(storeId);

    // Update theme_settings table
    const themeConfig = {
      colors,
      updatedAt: new Date().toISOString()
    };

    await tenantDb('theme_settings')
      .insert({
        store_id: storeId,
        setting_key: 'theme_colors',
        setting_value: JSON.stringify(themeConfig),
        created_at: new Date(),
        updated_at: new Date()
      })
      .onConflict(['store_id', 'setting_key'])
      .merge({
        setting_value: JSON.stringify(themeConfig),
        updated_at: new Date()
      });

    // Generate CSS variables
    const cssVariables = Object.entries(colors)
      .filter(([_, value]) => value)
      .map(([key, value]) => {
        const cssVar = key.replace(/([A-Z])/g, '-$1').toLowerCase();
        return `--${cssVar}: ${value}`;
      })
      .join(';\n');

    return {
      success: true,
      message: `Updated theme colors: ${Object.keys(colors).filter(k => colors[k]).join(', ')}`,
      changes: colors,
      cssVariables,
      refreshPreview: true
    };
  }

  /**
   * Get current page layout
   */
  async _executeGetCurrentLayout({ pageType }, storeId) {
    const tenantDb = await ConnectionManager.getStoreConnection(storeId);

    const slots = await tenantDb('page_slots')
      .where({ store_id: storeId, page_type: pageType })
      .orderBy('row_position')
      .orderBy('col_position');

    const layoutConfig = await tenantDb('layout_config')
      .where({ store_id: storeId, page_type: pageType });

    return {
      success: true,
      data: {
        pageType,
        slots: slots.map(s => ({
          id: s.slot_id,
          type: s.slot_type,
          content: s.content,
          position: { row: s.row_position, col: s.col_position },
          size: { colSpan: s.col_span, rowSpan: s.row_span },
          visible: s.is_visible
        })),
        config: layoutConfig.reduce((acc, c) => {
          acc[c.config_key] = JSON.parse(c.config_value || '{}');
          return acc;
        }, {})
      }
    };
  }

  /**
   * Get all mega menus
   */
  async _executeGetMegaMenus(storeId) {
    const tenantDb = await ConnectionManager.getStoreConnection(storeId);

    const menus = await tenantDb('mega_menus')
      .where({ store_id: storeId })
      .orderBy('position');

    return {
      success: true,
      data: {
        menus: menus.map(m => ({
          id: m.menu_id,
          title: m.title,
          type: m.menu_type,
          position: m.position,
          enabled: m.is_enabled,
          content: JSON.parse(m.content || '{}')
        }))
      }
    };
  }

  /**
   * Get theme settings
   */
  async _executeGetThemeSettings(storeId) {
    const tenantDb = await ConnectionManager.getStoreConnection(storeId);

    const settings = await tenantDb('theme_settings')
      .where({ store_id: storeId });

    const themeConfig = settings.reduce((acc, s) => {
      acc[s.setting_key] = JSON.parse(s.setting_value || '{}');
      return acc;
    }, {});

    return {
      success: true,
      data: themeConfig
    };
  }

  /**
   * Get the system prompt for store editing AI
   * This provides context to the AI about what it can do
   */
  getSystemPrompt() {
    return `You are an AI assistant that helps users customize their e-commerce store through natural language commands.

You have access to tools that can:
- **Style elements**: Change colors, fonts, sizes, spacing of any element (product titles, buttons, headers, etc.)
- **Manage layout**: Add, remove, or move content slots on any page
- **Configure mega menus**: Add rich navigation menus with categories, featured products, or custom content
- **Update content**: Change text or HTML content in any slot
- **Toggle visibility**: Show or hide elements like SKU, reviews, filters, etc.
- **Update theme**: Change the store's color scheme globally

IMPORTANT GUIDELINES:
1. When the user asks to change something, first understand what they want, then use the appropriate tool
2. If you need to see the current state, use get_current_layout, get_mega_menus, or get_theme_settings first
3. After making changes, summarize what you did
4. If a request is ambiguous, ask for clarification
5. Be proactive - if changing one thing would benefit from related changes, suggest them

EXAMPLES:
- "Make the product title green" -> use update_element_style with element="product-title" and styles={color: "green"}
- "Add a promotional banner at the top" -> use add_slot with slotType="banner" and position="top"
- "Create a mega menu for categories" -> use add_mega_menu_slot with menuType="categories"
- "Hide the SKU on product pages" -> use toggle_element_visibility with element="product-sku" and visible=false`;
  }
}

module.exports = new StoreEditingService();
