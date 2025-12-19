-- Seed Slot Grid Context for AI RAG System
-- This provides detailed slot hierarchy information for AI understanding
--
-- SAFE TO RE-RUN: Deletes existing slot_grid entries before inserting

-- Cleanup existing slot grid context
DELETE FROM ai_context_documents WHERE type IN ('slot_grid', 'intent_guide');

-- Product Page Slot Grid
INSERT INTO ai_context_documents (type, title, content, category, tags, priority, mode, is_active) VALUES
('slot_grid', 'Product Page Slot Grid',
'PRODUCT PAGE SLOT HIERARCHY (info_container children - this is what users typically modify):

info_container (parent container for product info, column 7-12):
├── Row 1: product_title        - "Product Name" text (h1)
├── Row 2: cms_block_above_price - CMS content slot
├── Row 3: price_container      - Contains prices
│   ├── product_price          - Main price (e.g., $99.00)
│   └── original_price         - Strikethrough price if on sale
├── Row 3: stock_status        - "In Stock" / "Out of Stock" component
├── Row 4: product_sku         - "SKU: ABC123" text
├── Row 5: product_short_description - Short description text
├── Row 7: options_container   - Product options
│   ├── configurable_product_selector - Size/Color dropdowns
│   └── custom_options         - Custom fields
└── Row 8: actions_container   - Buy actions
    ├── quantity_selector      - Qty input with +/-
    ├── total_price_display    - Total price
    └── buttons_container
        ├── add_to_cart_button - Main CTA button
        └── wishlist_button    - Heart icon

ROOT LEVEL SLOTS (parentId: null):
├── Row 0: cms_block_product_above - Banner above product
├── Row 1: main_layout            - Main container (12 cols)
│   ├── breadcrumbs_container     - Breadcrumb nav
│   ├── content_area              - 2-column grid
│   │   ├── product_title_mobile  - Mobile-only title
│   │   ├── product_gallery_container - Images (col 1-6)
│   │   └── info_container        - Info (col 7-12) - see above
│   ├── product_tabs              - Desc/Specs/Reviews tabs
│   └── related_products_container - Related products grid
└── Row 5: cms_block_product_below - Banner below product

TO MOVE SLOTS:
- "move sku above price" = Change product_sku row from 4 to 2 (before price_container row 3)
- "move title below price" = Change product_title row from 1 to 4 (after price_container row 3)
- Lower row number = appears ABOVE/BEFORE
- Higher row number = appears BELOW/AFTER
- Slots with same parentId can be reordered by changing position.row',
'core', '["product", "slots", "grid", "hierarchy", "layout"]', 100, 'all', true),

('slot_grid', 'Category Page Slot Grid',
'CATEGORY PAGE SLOT HIERARCHY:

ROOT STRUCTURE:
├── page_header (top section)
│   ├── breadcrumbs_content    - Category breadcrumbs
│   ├── category_title         - Category name (h1)
│   └── category_description   - Category description
│
├── filters_container (left sidebar, col 1-3)
│   ├── filters_above_cms      - CMS slot above filters
│   ├── filter_heading         - "Filters" heading
│   ├── active_filters         - Active filter badges
│   ├── layered_navigation     - Filter options component
│   └── filters_below_cms      - CMS slot below filters
│
└── products_container (main content, col 4-12)
    ├── mobile_filter_toggle   - Mobile filter button
    ├── sorting_controls       - Sort/view controls
    │   ├── product_count_info - "Showing X products"
    │   ├── sort_selector      - Sort dropdown
    │   └── view_mode_toggle   - Grid/List toggle
    ├── products_above_cms     - CMS slot
    ├── product_items          - Product grid
    │   └── product_card_template (repeated per product)
    │       ├── product_card_image
    │       └── product_card_content
    │           ├── product_card_name
    │           ├── product_card_price_container
    │           ├── product_card_stock_label
    │           └── product_card_add_to_cart
    ├── products_below_cms     - CMS slot
    └── pagination_container   - Page navigation

PRODUCT CARD TEMPLATE:
Changes to product_card_template slots affect ALL product cards.
Instance IDs: product_card_name_0, product_card_name_1, etc.',
'core', '["category", "slots", "grid", "filters", "products"]', 95, 'all', true),

('slot_grid', 'Header Slot Grid',
'HEADER SLOT HIERARCHY:

header_main (main header container):
├── Row 1: header_top_bar      - Announcement bar
│   ├── top_bar_message        - Left message text
│   └── top_bar_links          - Right links
├── Row 2: header_content      - Main header row
│   ├── store_logo             - Logo image/text
│   ├── search_bar             - Search input
│   ├── navigation_bar         - Main nav links
│   └── user_account_menu      - Account/Cart icons
│       ├── account_icon       - User icon
│       ├── cart_icon          - Shopping cart
│       └── cart_badge         - Item count badge
└── Row 3: header_bottom       - Optional bottom nav

MOBILE MENU:
├── mobile_menu_toggle         - Hamburger button
└── mobile_menu_panel          - Slide-out menu
    ├── mobile_nav_links       - Navigation
    └── mobile_account_links   - Account links',
'core', '["header", "slots", "navigation", "menu"]', 90, 'all', true),

('slot_grid', 'Cart Page Slot Grid',
'CART PAGE SLOT HIERARCHY:

cart_main (main container):
├── cart_header               - "Shopping Cart" title
├── cart_items_container      - Cart items list
│   └── cart_item_template    - Per-item template
│       ├── cart_item_image   - Product thumbnail
│       ├── cart_item_details - Name, options
│       ├── cart_item_quantity - Qty selector
│       ├── cart_item_price   - Line total
│       └── cart_item_remove  - Remove button
├── cart_summary              - Order summary
│   ├── subtotal_row          - Subtotal
│   ├── shipping_row          - Shipping estimate
│   ├── discount_row          - Coupon discount
│   ├── tax_row               - Tax amount
│   └── total_row             - Grand total
├── coupon_input              - Coupon code field
├── cart_actions              - Buttons
│   ├── continue_shopping     - Back to shop
│   └── checkout_button       - Proceed to checkout
└── cart_empty_state          - Empty cart message',
'core', '["cart", "slots", "checkout", "summary"]', 85, 'all', true),

('intent_guide', 'Layout Modify - Grid Understanding',
'UNDERSTANDING SLOT POSITIONS:

POSITION OBJECT:
Each slot has position: { col: X, row: Y }
- row: Vertical position (1 = top, higher = lower)
- col: Horizontal position in grid (1-12)

MOVING SLOTS:
- "move A above B" = Set A.row to be less than B.row
- "move A below B" = Set A.row to be greater than B.row
- "move A to left of B" = Set A.col < B.col (rarely used)

SAME CONTAINER RULE:
Slots must have same parentId to reorder.
- product_title.parentId = "info_container"
- product_sku.parentId = "info_container"
- So they CAN be reordered relative to each other

CROSS-CONTAINER MOVE:
To move slot to different container:
1. Change slot.parentId to new container
2. Set appropriate position.row in new container

COMMON PRODUCT PAGE MOVES:
- "move sku above price" = product_sku.row = 2 (before price_container row 3)
- "move title below sku" = product_title.row = 5 (after product_sku row 4)
- "move description above options" = product_short_description.row = 6',
'layout', '["move", "reorder", "position", "grid", "row", "column"]', 100, 'all', true);

-- Update existing entries to ensure they're active
UPDATE ai_context_documents SET is_active = true WHERE type = 'slot_grid';
