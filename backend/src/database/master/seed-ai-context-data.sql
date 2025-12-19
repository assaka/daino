-- Seed AI Context Data for Master Database
-- Run this after create-ai-master-tables.sql

-- ============================================
-- AI CONTEXT DOCUMENTS - Knowledge Base
-- ============================================

TRUNCATE TABLE ai_code_patterns cascade;
TRUNCATE TABLE ai_context_documents cascade;
TRUNCATE TABLE ai_context_usage cascade;
TRUNCATE TABLE ai_entity_definitions cascade;
TRUNCATE TABLE ai_plugin_examples cascade;

-- Styling Intent Documents
INSERT INTO ai_context_documents (type, title, content, category, tags, priority, mode, is_active) VALUES
('intent_guide', 'Styling Intent - Colors',
'When users want to change colors, detect the STYLING intent.

KEYWORDS: color, background, text color, font color, primary, secondary, accent, dark, light, theme

EXAMPLES:
- "change the header background to blue" -> styling intent, target: header, property: background-color
- "make the button red" -> styling intent, target: button, property: background-color
- "use darker text" -> styling intent, target: body, property: color
- "change primary color to #FF5733" -> styling intent, target: :root, property: --primary-color

CSS PROPERTIES FOR COLORS:
- background-color: Element background
- color: Text color
- border-color: Border color
- --primary-color: CSS variable for primary theme color
- --secondary-color: CSS variable for secondary theme color
- --accent-color: CSS variable for accent/highlight color

RESPONSE FORMAT:
Generate CSS that targets the specific element and property.',
'styling', '["color", "background", "theme", "css"]', 90, 'all', true),

('intent_guide', 'Styling Intent - Typography',
'When users want to change fonts, text size, or typography.

KEYWORDS: font, text, size, bigger, smaller, bold, italic, heading, paragraph, typography

EXAMPLES:
- "make the title bigger" -> styling intent, target: h1/.title, property: font-size
- "use a different font" -> styling intent, target: body, property: font-family
- "bold the product name" -> styling intent, target: .product-name, property: font-weight

CSS PROPERTIES:
- font-size: Text size (use rem or px)
- font-family: Font typeface
- font-weight: Bold/normal (400, 500, 600, 700)
- line-height: Spacing between lines
- letter-spacing: Space between letters
- text-transform: uppercase, lowercase, capitalize',
'styling', '["font", "typography", "text", "size"]', 85, 'all', true),

('intent_guide', 'Styling Intent - Spacing & Layout',
'When users want to change spacing, padding, margins, or gaps.

KEYWORDS: spacing, padding, margin, gap, space, wider, narrower, tighter, looser

EXAMPLES:
- "add more space between products" -> styling intent, target: .product-grid, property: gap
- "reduce padding on cards" -> styling intent, target: .card, property: padding
- "more margin around the header" -> styling intent, target: header, property: margin

CSS PROPERTIES:
- padding: Inner spacing (padding-top, padding-bottom, etc.)
- margin: Outer spacing (margin-top, margin-bottom, etc.)
- gap: Space between grid/flex items
- row-gap, column-gap: Specific gap directions',
'styling', '["spacing", "padding", "margin", "layout"]', 85, 'all', true),

('intent_guide', 'Layout Modification Intent',
'When users want to move, reorder, swap, or remove elements.

KEYWORDS: move, swap, reorder, position, above, below, before, after, remove, hide, show

EXAMPLES:
- "move the SKU above the price" -> layout_modify intent, action: reorder
- "swap description and specifications" -> layout_modify intent, action: swap
- "remove the reviews section" -> layout_modify intent, action: remove
- "hide the stock indicator" -> layout_modify intent, action: hide

SLOT SYSTEM:
The storefront uses a slot-based layout system. Each page section has slots that can be reordered.
- product-info-main: Main product info area (title, price, sku, stock, etc.)
- product-details: Product details area (description, specs, reviews)

To reorder: Update the slot_order in page_slot_configurations table.',
'layout', '["layout", "reorder", "move", "slots"]', 90, 'all', true),

('intent_guide', 'Admin Entity Intent',
'When users want to modify admin settings, configurations, or data.

KEYWORDS: change, update, rename, create, delete, enable, disable, add, remove, set

ENTITY TYPES:
- product_tabs: Product page tabs (Description, Specifications, Reviews)
- store_settings: Store configuration (name, currency, timezone)
- seo_settings: SEO configuration (meta tags, sitemap)
- payment_methods: Payment gateway settings
- shipping_methods: Shipping options and rates
- categories: Product categories
- attributes: Product attributes
- coupons: Discount codes
- email_templates: Notification emails
- cms_pages: Static content pages
- languages: Supported languages
- translations: UI text translations

EXAMPLES:
- "rename the Specs tab to Technical Details" -> admin_entity, entity: product_tabs
- "change store currency to EUR" -> admin_entity, entity: store_settings
- "create a 20% discount code SUMMER20" -> admin_entity, entity: coupons
- "disable PayPal" -> admin_entity, entity: payment_methods',
'admin', '["admin", "settings", "entity", "configuration"]', 95, 'all', true),

('intent_guide', 'Translation Intent',
'When users want to translate or change UI text.

KEYWORDS: translate, translation, language, text, label, change text, rename label

EXAMPLES:
- "translate Add to Cart to German" -> translation intent
- "change the checkout button text" -> translation intent
- "rename Buy Now to Purchase" -> translation intent

TRANSLATION SYSTEM:
Translations are stored per language with keys like:
- product.add_to_cart
- checkout.place_order
- common.submit',
'translations', '["translation", "language", "i18n", "text"]', 80, 'all', true),

('intent_guide', 'Plugin Development Intent',
'When users want to create or modify plugins/extensions.

KEYWORDS: plugin, extension, custom, widget, component, create plugin, add feature

EXAMPLES:
- "create a countdown timer widget" -> plugin intent
- "add a newsletter popup" -> plugin intent
- "build a product comparison feature" -> plugin intent

PLUGIN STRUCTURE:
Plugins are JavaScript/JSX files that export:
- meta: Plugin metadata (name, version, description)
- slots: Where the plugin renders
- Component: React component
- hooks: Event handlers',
'plugins', '["plugin", "extension", "widget", "development"]', 75, 'developer', true),

-- Architecture Documents
('architecture', 'Storefront Slot System',
'The storefront uses a slot-based architecture for flexible layouts.

SLOT AREAS:
1. Header Slots: header-top, header-main, header-bottom
2. Product Page Slots:
   - product-info-main: SKU, title, price, stock, add-to-cart
   - product-info-sidebar: Related products, recently viewed
   - product-details: Description, specifications, reviews
3. Category Page Slots: category-header, product-grid, category-sidebar
4. Footer Slots: footer-top, footer-main, footer-bottom

SLOT CONFIGURATION TABLE: page_slot_configurations
- page_type: Which page (product, category, home)
- slot_area: Which slot area
- slot_name: Specific slot name
- slot_order: Display order (lower = first)
- is_visible: Show/hide slot
- custom_css: Per-slot styling

To reorder slots: UPDATE page_slot_configurations SET slot_order = X WHERE slot_name = Y',
'core', '["slots", "layout", "architecture", "pages"]', 100, 'all', true),

('architecture', 'CSS Variables System',
'The theme uses CSS variables for consistent styling.

ROOT VARIABLES (in :root):
--primary-color: Main brand color
--secondary-color: Secondary brand color
--accent-color: Highlight/accent color
--background-color: Page background
--text-color: Main text color
--heading-color: Heading text color
--border-color: Border color
--border-radius: Corner rounding
--font-family: Main font
--font-size-base: Base text size
--spacing-unit: Base spacing (usually 8px)

COMPONENT VARIABLES:
--header-bg: Header background
--header-text: Header text color
--button-bg: Button background
--button-text: Button text
--card-bg: Card background
--card-shadow: Card shadow

To change theme: Update CSS variables in the theme settings or custom CSS.',
'core', '["css", "variables", "theme", "styling"]', 95, 'all', true),

('best_practices', 'AI Response Guidelines',
'Guidelines for generating AI responses.

1. BE SPECIFIC: Always identify the exact element/selector
2. PROVIDE CSS: Include ready-to-use CSS code when styling
3. CONFIRM ACTIONS: Summarize what was changed
4. OFFER ALTERNATIVES: Suggest related improvements
5. STAY SCOPED: Only change what was requested
6. USE VARIABLES: Prefer CSS variables over hardcoded values
7. RESPONSIVE: Consider mobile when changing layouts

RESPONSE STRUCTURE:
1. Acknowledge the request
2. Explain what will be changed
3. Provide the code/changes
4. Confirm completion
5. Suggest related improvements (optional)',
'core', '["guidelines", "responses", "best-practices"]', 80, 'all', true);

-- ============================================
-- AI ENTITY DEFINITIONS - Admin Entities
-- ============================================

INSERT INTO ai_entity_definitions (entity_name, display_name, description, table_name, supported_operations, fields, primary_key, tenant_column, intent_keywords, example_prompts, category, priority, is_active) VALUES

('product_tabs', 'Product Tabs', 'Tabs shown on product detail pages (Description, Specifications, Reviews)',
'product_tabs',
'["list", "get", "create", "update", "delete"]',
'[{"name": "id", "type": "uuid", "required": false}, {"name": "name", "type": "string", "required": true}, {"name": "slug", "type": "string", "required": true}, {"name": "content_type", "type": "string", "required": true}, {"name": "order", "type": "integer", "required": false}, {"name": "is_active", "type": "boolean", "required": false}]',
'id', 'store_id',
'["tab", "tabs", "product tab", "description tab", "specs tab", "specifications", "reviews tab"]',
'["rename the specs tab", "add a new product tab", "reorder product tabs", "hide the reviews tab", "change tab name"]',
'products', 90, true),

('store_settings', 'Store Settings', 'General store configuration like name, currency, timezone',
'store_settings',
'["get", "update"]',
'[{"name": "store_name", "type": "string"}, {"name": "store_email", "type": "string"}, {"name": "currency", "type": "string"}, {"name": "timezone", "type": "string"}, {"name": "date_format", "type": "string"}, {"name": "weight_unit", "type": "string"}]',
'id', 'store_id',
'["store name", "currency", "timezone", "store settings", "shop name", "business name"]',
'["change store name", "update currency to EUR", "set timezone to UTC"]',
'settings', 95, true),

('seo_settings', 'SEO Settings', 'Search engine optimization settings',
'seo_settings',
'["get", "update"]',
'[{"name": "meta_title", "type": "string"}, {"name": "meta_description", "type": "string"}, {"name": "meta_keywords", "type": "string"}, {"name": "og_image", "type": "string"}, {"name": "robots_txt", "type": "text"}, {"name": "sitemap_enabled", "type": "boolean"}]',
'id', 'store_id',
'["seo", "meta", "title", "description", "keywords", "sitemap", "robots"]',
'["update meta title", "change SEO description", "enable sitemap"]',
'settings', 85, true),

('payment_methods', 'Payment Methods', 'Payment gateway configurations',
'payment_methods',
'["list", "get", "update"]',
'[{"name": "id", "type": "uuid"}, {"name": "name", "type": "string"}, {"name": "provider", "type": "string"}, {"name": "is_active", "type": "boolean"}, {"name": "is_default", "type": "boolean"}, {"name": "settings", "type": "json"}]',
'id', 'store_id',
'["payment", "payments", "paypal", "stripe", "credit card", "payment method", "checkout"]',
'["enable PayPal", "disable Stripe", "set default payment method", "configure payment gateway"]',
'settings', 85, true),

('shipping_methods', 'Shipping Methods', 'Shipping options and rates',
'shipping_methods',
'["list", "get", "create", "update", "delete"]',
'[{"name": "id", "type": "uuid"}, {"name": "name", "type": "string"}, {"name": "description", "type": "string"}, {"name": "price", "type": "decimal"}, {"name": "is_active", "type": "boolean"}, {"name": "min_order", "type": "decimal"}, {"name": "max_order", "type": "decimal"}]',
'id', 'store_id',
'["shipping", "delivery", "shipping method", "shipping rate", "free shipping", "express"]',
'["add free shipping", "create express delivery option", "update shipping rates", "disable shipping method"]',
'settings', 80, true),

('categories', 'Categories', 'Product categories and hierarchy',
'categories',
'["list", "get", "create", "update", "delete"]',
'[{"name": "id", "type": "uuid"}, {"name": "name", "type": "string", "required": true}, {"name": "slug", "type": "string"}, {"name": "description", "type": "text"}, {"name": "parent_id", "type": "uuid"}, {"name": "image", "type": "string"}, {"name": "is_active", "type": "boolean"}]',
'id', 'store_id',
'["category", "categories", "product category", "collection", "department"]',
'["create a new category", "rename Electronics to Tech", "add subcategory", "delete category"]',
'products', 85, true),

('attributes', 'Product Attributes', 'Product attributes like Size, Color',
'product_attributes',
'["list", "get", "create", "update", "delete"]',
'[{"name": "id", "type": "uuid"}, {"name": "name", "type": "string", "required": true}, {"name": "slug", "type": "string"}, {"name": "type", "type": "string"}, {"name": "values", "type": "json"}, {"name": "is_filterable", "type": "boolean"}, {"name": "is_visible", "type": "boolean"}]',
'id', 'store_id',
'["attribute", "attributes", "size", "color", "variant", "option", "product attribute"]',
'["create Size attribute", "add Color options", "make attribute filterable"]',
'products', 75, true),

('coupons', 'Coupons', 'Discount codes and promotions',
'coupons',
'["list", "get", "create", "update", "delete"]',
'[{"name": "id", "type": "uuid"}, {"name": "code", "type": "string", "required": true}, {"name": "description", "type": "string"}, {"name": "discount_type", "type": "string", "required": true}, {"name": "discount_value", "type": "decimal", "required": true}, {"name": "min_order", "type": "decimal"}, {"name": "max_uses", "type": "integer"}, {"name": "starts_at", "type": "timestamp"}, {"name": "expires_at", "type": "timestamp"}, {"name": "is_active", "type": "boolean"}]',
'id', 'store_id',
'["coupon", "discount", "promo", "promotion", "discount code", "voucher", "sale"]',
'["create 20% discount code", "add coupon SUMMER20", "disable expired coupons", "create free shipping coupon"]',
'marketing', 90, true),

('email_templates', 'Email Templates', 'Notification email templates',
'email_templates',
'["list", "get", "update"]',
'[{"name": "id", "type": "uuid"}, {"name": "name", "type": "string"}, {"name": "slug", "type": "string"}, {"name": "subject", "type": "string"}, {"name": "body", "type": "text"}, {"name": "is_active", "type": "boolean"}]',
'id', 'store_id',
'["email", "template", "notification", "email template", "order confirmation", "welcome email"]',
'["edit order confirmation email", "update welcome email", "change email subject"]',
'settings', 70, true),

('cms_pages', 'CMS Pages', 'Static content pages (About, Contact, etc.)',
'cms_pages',
'["list", "get", "create", "update", "delete"]',
'[{"name": "id", "type": "uuid"}, {"name": "title", "type": "string", "required": true}, {"name": "slug", "type": "string"}, {"name": "content", "type": "text"}, {"name": "meta_title", "type": "string"}, {"name": "meta_description", "type": "string"}, {"name": "is_active", "type": "boolean"}]',
'id', 'store_id',
'["page", "cms", "content", "about", "contact", "faq", "terms", "privacy", "static page"]',
'["create About Us page", "edit Contact page", "add FAQ page", "update privacy policy"]',
'content', 75, true),

('languages', 'Languages', 'Supported store languages',
'languages',
'["list", "get", "create", "update", "delete"]',
'[{"name": "id", "type": "uuid"}, {"name": "code", "type": "string", "required": true}, {"name": "name", "type": "string", "required": true}, {"name": "is_default", "type": "boolean"}, {"name": "is_active", "type": "boolean"}]',
'id', 'store_id',
'["language", "languages", "locale", "translation", "multilingual", "german", "french", "spanish"]',
'["add German language", "enable French", "set default language", "disable language"]',
'translations', 80, true),

('tax_settings', 'Tax Settings', 'Tax rates and configuration',
'tax_settings',
'["list", "get", "create", "update", "delete"]',
'[{"name": "id", "type": "uuid"}, {"name": "name", "type": "string", "required": true}, {"name": "rate", "type": "decimal", "required": true}, {"name": "country", "type": "string"}, {"name": "region", "type": "string"}, {"name": "is_active", "type": "boolean"}]',
'id', 'store_id',
'["tax", "taxes", "vat", "sales tax", "tax rate", "tax settings"]',
'["add 19% VAT", "create tax rate for Germany", "update tax settings"]',
'settings', 70, true);

-- ============================================
-- AI CODE PATTERNS - Reusable Snippets
-- ============================================

INSERT INTO ai_code_patterns (name, pattern_type, description, code, language, framework, example_usage, tags, is_active) VALUES

('Change Element Color', 'css', 'Pattern for changing color of any element',
'.selector {
  background-color: #YOUR_COLOR;
  /* or for text: */
  color: #YOUR_COLOR;
}',
'css', 'css',
'Use this pattern to change background or text color of elements. Replace .selector with the target element class/id.',
'["color", "background", "styling"]', true),

('CSS Variables Theme', 'css', 'Pattern for updating theme via CSS variables',
':root {
  --primary-color: #YOUR_PRIMARY;
  --secondary-color: #YOUR_SECONDARY;
  --accent-color: #YOUR_ACCENT;
}',
'css', 'css',
'Update root CSS variables to change theme colors globally.',
'["theme", "variables", "colors"]', true),

('Responsive Font Size', 'css', 'Pattern for responsive typography',
'.element {
  font-size: clamp(1rem, 2vw + 0.5rem, 2rem);
  /* or fixed: */
  font-size: 1.25rem;
}',
'css', 'css',
'Use clamp() for responsive sizing or fixed rem/px values.',
'["font", "typography", "responsive"]', true),

('Slot Reorder Query', 'database', 'SQL pattern for reordering slots',
'UPDATE page_slot_configurations
SET slot_order = CASE
  WHEN slot_name = ''slot_a'' THEN 2
  WHEN slot_name = ''slot_b'' THEN 1
  ELSE slot_order
END
WHERE store_id = $1
AND page_type = ''product''
AND slot_area = ''product-info-main'';',
'sql', 'postgresql',
'Use this to swap or reorder slots. Adjust slot_name and slot_order values.',
'["slots", "reorder", "layout"]', true),

('Hide Element CSS', 'css', 'Pattern for hiding elements',
'.element-to-hide {
  display: none !important;
}
/* or for screen readers: */
.visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  clip: rect(0, 0, 0, 0);
}',
'css', 'css',
'Use display:none to hide completely, or visually-hidden for accessibility.',
'["hide", "visibility", "display"]', true),

('Button Styling', 'css', 'Common button style pattern',
'.button {
  background-color: var(--primary-color);
  color: white;
  padding: 0.75rem 1.5rem;
  border: none;
  border-radius: var(--border-radius);
  cursor: pointer;
  transition: background-color 0.2s ease;
}
.button:hover {
  background-color: var(--primary-color-dark);
}',
'css', 'css',
'Standard button styling with hover effect.',
'["button", "styling", "hover"]', true),

('Card Component Style', 'css', 'Pattern for card/box components',
'.card {
  background: var(--card-bg, white);
  border-radius: var(--border-radius);
  box-shadow: var(--card-shadow, 0 2px 8px rgba(0,0,0,0.1));
  padding: 1.5rem;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}
.card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0,0,0,0.15);
}',
'css', 'css',
'Card component with shadow and hover effect.',
'["card", "component", "shadow"]', true),

('Grid Layout', 'css', 'Responsive grid pattern',
'.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  gap: 1.5rem;
}',
'css', 'css',
'Responsive grid that auto-fills columns based on available space.',
'["grid", "layout", "responsive"]', true),

('Flexbox Center', 'css', 'Center content with flexbox',
'.flex-center {
  display: flex;
  justify-content: center;
  align-items: center;
}',
'css', 'css',
'Center content both horizontally and vertically.',
'["flexbox", "center", "alignment"]', true),

('Entity Update Response', 'successful_prompt', 'Successful entity update pattern',
'{"user_message": "rename the specs tab to Technical Details", "entity": "product_tabs", "operation": "update", "success": true}',
'json', 'ai-learning',
'Pattern for successful entity update operations.',
'["entity", "update", "successful"]', true);

-- ============================================
-- AI PLUGIN EXAMPLES - Code Examples
-- ============================================

INSERT INTO ai_plugin_examples (name, slug, description, category, complexity, code, features, use_cases, tags, is_active) VALUES

('Countdown Timer Widget', 'countdown-timer',
'A countdown timer plugin for sales and promotions',
'marketing', 'simple',
'export const meta = {
  name: "Countdown Timer",
  version: "1.0.0",
  description: "Display countdown to sales or events"
};

export const slots = ["header-top", "product-info-main"];

export function Component({ endDate, label }) {
  const [timeLeft, setTimeLeft] = useState(calculateTimeLeft(endDate));

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(calculateTimeLeft(endDate));
    }, 1000);
    return () => clearInterval(timer);
  }, [endDate]);

  return (
    <div className="countdown-timer">
      <span className="countdown-label">{label}</span>
      <div className="countdown-digits">
        <span>{timeLeft.days}d</span>
        <span>{timeLeft.hours}h</span>
        <span>{timeLeft.minutes}m</span>
        <span>{timeLeft.seconds}s</span>
      </div>
    </div>
  );
}',
'["countdown", "timer", "animation"]',
'["flash sales", "product launches", "event promotions", "limited offers"]',
'["timer", "countdown", "sales", "urgency"]', true),

('Social Proof Badge', 'social-proof-badge',
'Shows recent purchases or views',
'marketing', 'simple',
'export const meta = {
  name: "Social Proof Badge",
  version: "1.0.0",
  description: "Display recent activity notifications"
};

export const slots = ["product-info-main"];

export function Component({ productId }) {
  const [activity, setActivity] = useState(null);

  useEffect(() => {
    // Fetch recent activity
    fetchRecentActivity(productId).then(setActivity);
  }, [productId]);

  if (!activity) return null;

  return (
    <div className="social-proof-badge">
      <span className="pulse-dot"></span>
      <span>{activity.count} people viewed this in the last hour</span>
    </div>
  );
}',
'["social proof", "notifications", "trust"]',
'["increase conversions", "build trust", "show popularity"]',
'["social", "proof", "trust", "conversion"]', true),

('Newsletter Popup', 'newsletter-popup',
'Email subscription popup with discount offer',
'marketing', 'intermediate',
'export const meta = {
  name: "Newsletter Popup",
  version: "1.0.0",
  description: "Capture emails with exit-intent popup"
};

export const hooks = {
  onPageLoad: (context) => {
    // Check if already subscribed
    if (localStorage.getItem("newsletter_subscribed")) return;

    // Exit intent detection
    document.addEventListener("mouseout", handleExitIntent);
  }
};

export function Component({ discount, title }) {
  const [email, setEmail] = useState("");
  const [isVisible, setIsVisible] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    await subscribeNewsletter(email);
    localStorage.setItem("newsletter_subscribed", "true");
    setIsVisible(false);
  };

  return isVisible ? (
    <div className="newsletter-popup-overlay">
      <div className="newsletter-popup">
        <button onClick={() => setIsVisible(false)}>X</button>
        <h2>{title || "Get " + discount + " Off!"}</h2>
        <p>Subscribe to our newsletter</p>
        <form onSubmit={handleSubmit}>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Enter your email"
          />
          <button type="submit">Subscribe</button>
        </form>
      </div>
    </div>
  ) : null;
}',
'["popup", "email capture", "exit intent", "discount"]',
'["grow email list", "reduce bounce rate", "offer discounts"]',
'["newsletter", "popup", "email", "marketing"]', true),

('Product Comparison', 'product-comparison',
'Compare multiple products side by side',
'commerce', 'advanced',
'export const meta = {
  name: "Product Comparison",
  version: "1.0.0",
  description: "Compare products side by side"
};

export const slots = ["category-header"];

export function Component() {
  const [compareList, setCompareList] = useLocalStorage("compare_list", []);

  const addToCompare = (product) => {
    if (compareList.length >= 4) {
      alert("Max 4 products");
      return;
    }
    setCompareList([...compareList, product]);
  };

  return (
    <div className="product-comparison">
      <button onClick={() => setShowModal(true)}>
        Compare ({compareList.length})
      </button>
      {showModal && (
        <ComparisonTable products={compareList} />
      )}
    </div>
  );
}',
'["comparison table", "product attributes", "side by side"]',
'["help customers decide", "highlight differences", "feature comparison"]',
'["compare", "comparison", "products", "features"]', true);

-- ============================================
-- DETAILED SLOT ARCHITECTURE DOCUMENTATION
-- ============================================

INSERT INTO ai_context_documents (type, title, content, category, tags, priority, mode, is_active) VALUES

('architecture', 'Slot Configuration System - Overview',
'The storefront uses a hierarchical slot-based layout system defined in config files.

CONFIG FILES:
- product-config.js: Product detail page layout
- category-config.js: Category/collection page layout
- header-config.js: Header layout
- cart-config.js: Cart page layout
- checkout-config.js: Checkout flow layout
- account-config.js: Account pages layout

SLOT STRUCTURE:
Each slot is defined with these properties:
{
  id: "slot_name",           // Unique identifier
  type: "container|grid|flex|text|image|button|component",
  component: "ComponentName", // For type="component", e.g., "ProductGallery"
  content: "{{variable}}",    // Handlebars template content
  className: "tailwind classes",
  parentClassName: "",        // Classes for parent wrapper
  styles: { css properties }, // Inline styles
  parentId: "parent_slot_id", // null for root slots
  position: { col: 1, row: 1 }, // Grid coordinates
  colSpan: 12,               // 1-12 column span (or object {default: 12, grid: 6})
  rowSpan: 1,                // Row span for height
  viewMode: ["default"],     // Which views to show in
  metadata: {
    hierarchical: true,
    displayName: "Human Readable Name",
    component: "ComponentName"
  }
}

HIERARCHY:
- Root slots have parentId: null
- Child slots reference parent via parentId
- Grid/container slots can have children
- Example: main_layout -> content_area -> info_container -> product_title',
'core', '["slots", "configuration", "architecture", "config"]', 100, 'developer', true),

('architecture', 'Slot Grid System - Positioning & Sizing',
'Slots use a 12-column CSS Grid system for responsive layouts.

GRID PROPERTIES:
- gridCols: 12 (default) - Total columns in grid
- colSpan: Number or object - How many columns slot spans
  - Simple: colSpan: 6 (6 columns wide)
  - Responsive: colSpan: { default: 12, grid: 6, list: 12 }
- rowSpan: Number - How many rows tall (default: 1)
- position: { col: 1, row: 1 } - Grid coordinates

POSITIONING:
- col: 1-12 column position (1 = leftmost)
- row: Sequential row number
- Slots are sorted by row, then column

RESIZING SLOTS:
To change slot width, update colSpan:
UPDATE slot_configurations
SET configuration = jsonb_set(
  configuration,
  ''{slots,product_gallery,colSpan}'',
  ''6''::jsonb
)
WHERE page_type = ''product'';

RESPONSIVE CLASSES:
Use Tailwind for responsive widths:
- col-span-12 lg:col-span-6 (full on mobile, half on desktop)
- colSpan can be string: "col-span-12 lg:col-span-6"',
'core', '["grid", "positioning", "colSpan", "resize", "responsive"]', 95, 'developer', true),

('architecture', 'Slot Reordering - Moving Elements',
'Slots can be reordered by updating their position coordinates.

REORDER WITHIN CONTAINER:
To move slot A before slot B in the same container:
1. Get slots with same parentId
2. Update position.row values
3. Lower row = appears first

EXAMPLE - Move SKU above Price:
-- Current: price at row 3, sku at row 4
-- Target: sku at row 3, price at row 4

UPDATE slot_configurations
SET configuration = jsonb_set(
  jsonb_set(
    configuration,
    ''{slots,product_sku,position,row}'',
    ''3''::jsonb
  ),
  ''{slots,product_price,position,row}'',
  ''4''::jsonb
)
WHERE page_type = ''product'';

MOVE TO DIFFERENT CONTAINER:
Change the parentId and position:
{
  "parentId": "new_parent_container",
  "position": { "col": 1, "row": 1 }
}

API ENDPOINT:
POST /api/slot-configurations/reorder
{
  "storeId": "...",
  "pageType": "product",
  "slotId": "product_sku",
  "newParentId": "info_container",
  "newPosition": { "col": 1, "row": 3 }
}',
'core', '["reorder", "move", "position", "parentId", "slots"]', 95, 'developer', true),

('architecture', 'Slot Types & Components',
'Different slot types serve different purposes.

SLOT TYPES:
1. container - Generic wrapper, can hold children
2. grid - CSS Grid container with gridCols
3. flex - Flexbox container
4. text - Text content with Handlebars variables
5. image - Image with src binding
6. button - Interactive button with action
7. component - React component reference
8. html - Raw HTML with script support

COMPONENT SLOTS:
Reference React components by name:
{
  type: "component",
  component: "ProductGallery",
  metadata: {
    component: "ProductGallery"
  }
}

Available components:
- ProductGallery: Image gallery with thumbnails
- StockStatus: Stock availability indicator
- QuantitySelector: Quantity input with +/- buttons
- CustomOptions: Product options selector
- ConfigurableProductSelector: Variant selector
- ProductTabsSlot: Description/Specs/Reviews tabs
- Breadcrumbs: Navigation breadcrumbs
- LayeredNavigation: Filters sidebar
- PaginationComponent: Page navigation
- CmsBlockRenderer: Dynamic CMS content

TEXT SLOTS WITH HANDLEBARS:
{
  type: "text",
  content: "{{product.name}}",
  metadata: { htmlTag: "h1" }
}

Variables: {{product.name}}, {{product.price}}, {{settings.currency_symbol}}, {{t "key"}}',
'core', '["types", "components", "text", "container", "slots"]', 90, 'developer', true),

('architecture', 'Adding New Slots - Editor & API',
'New slots can be added via the visual editor or API.

VIA VISUAL EDITOR:
1. Click "+ Add Element" in editor
2. Select slot type (text, image, container)
3. Choose parent container
4. Slot is created with default position

VIA API:
POST /api/slot-configurations/slots
{
  "storeId": "...",
  "pageType": "product",
  "slot": {
    "id": "custom_banner",
    "type": "text",
    "content": "Free shipping on orders over $50!",
    "className": "bg-blue-500 text-white p-4 text-center",
    "parentId": "main_layout",
    "position": { "col": 1, "row": 0 },
    "colSpan": 12,
    "viewMode": ["default"],
    "metadata": {
      "hierarchical": true,
      "isCustom": true,
      "displayName": "Promo Banner"
    }
  }
}

SLOT ID NAMING:
- Use snake_case: custom_promo_banner
- Prefix with purpose: cms_block_*, custom_*
- Include location: header_*, footer_*, sidebar_*

MAKING SLOTS EDITABLE:
Add to metadata:
{
  metadata: {
    displayName: "My Custom Slot",
    customizable: ["content", "className", "styles"],
    editableProperties: ["fontSize", "color", "backgroundColor"]
  }
}',
'core', '["add", "create", "new slot", "editor", "API"]', 90, 'developer', true),

('architecture', 'CMS Blocks Integration',
'CMS blocks allow dynamic content injection into slot areas.

CMS BLOCK SLOTS:
{
  id: "cms_block_product_above",
  type: "component",
  component: "CmsBlockRenderer",
  metadata: {
    cmsPosition: "product_above",
    props: { position: "product_above" }
  }
}

CMS POSITIONS (Product Page):
- product_above: Above entire product section
- product_above_price: Between title and price
- product_below_price: After price
- product_above_cart_button: Before add to cart
- product_below_cart_button: After add to cart
- product_below: Below entire product section

CMS POSITIONS (Category Page):
- category_above_filters: Above filter sidebar
- category_below_filters: Below filter sidebar
- category_above_products: Above product grid
- category_below_products: Below product grid

CREATING CMS CONTENT:
1. Go to Admin > Content > CMS Blocks
2. Create block with position matching cmsPosition
3. Content automatically renders in that slot

HTML/SCRIPT IN CMS:
CMS blocks can contain:
- HTML content
- Inline CSS
- JavaScript (with caution)
- Handlebars variables',
'core', '["cms", "blocks", "content", "dynamic", "positions"]', 85, 'developer', true),

('architecture', 'Slot Configuration Service - useSlotConfiguration Hook',
'The useSlotConfiguration hook manages slot state in editors.

HOOK USAGE:
const {
  handleResetLayout,      // Reset to default config
  handlePublishConfiguration, // Publish draft to live
  getDraftConfiguration,  // Get current draft
  createSlot,            // Add new slot
  handleSlotDrop,        // Reorder slots
  handleSlotDelete,      // Remove slot
  handleGridResize,      // Change colSpan
  handleTextChange,      // Update text content
  handleClassChange      // Update className/styles
} = useSlotConfiguration({
  pageType: "product",
  pageName: "Product Detail",
  slotType: "product_layout",
  selectedStore
});

DRAFT/PUBLISH WORKFLOW:
1. Edit slots -> changes saved to draft
2. Preview draft changes
3. Publish draft -> becomes live
4. Can revert to previous published version

CONFIGURATION STORAGE:
- slot_configurations table in tenant DB
- status: "init", "draft", "published"
- configuration: JSONB with slots object
- Versioning tracks history

AUTO-SAVE:
Changes auto-save to draft after 500ms debounce.
Explicit publish required to go live.',
'core', '["hook", "useSlotConfiguration", "draft", "publish", "service"]', 85, 'developer', true),

('architecture', 'Product Page Slot Hierarchy',
'Product page slot structure from product-config.js.

HIERARCHY:
cms_block_product_above (root, row 0)
main_layout (root, row 1)
├── breadcrumbs_container (row 1)
│   └── breadcrumbs
├── content_area (row 2)
│   ├── product_title_mobile (mobile only)
│   ├── product_gallery_container (col 1-6)
│   └── info_container (col 7-12)
│       ├── product_title
│       ├── cms_block_product_above_price
│       ├── price_container
│       │   ├── product_price
│       │   └── original_price
│       ├── stock_status
│       ├── product_sku
│       ├── product_short_description
│       ├── options_container
│       │   ├── configurable_product_selector
│       │   └── custom_options
│       └── actions_container
│           ├── quantity_selector
│           ├── total_price_display
│           └── buttons_container
│               ├── add_to_cart_button
│               └── wishlist_button
├── product_tabs (row 3)
└── related_products_container (row 4)
cms_block_product_below (root, row 5)

KEY SLOTS TO MODIFY:
- product_sku: SKU display position
- stock_status: In/out of stock indicator
- product_price: Main price display
- add_to_cart_button: Buy button styling',
'core', '["product", "hierarchy", "structure", "slots", "layout"]', 90, 'developer', true),

('architecture', 'Category Page Slot Hierarchy',
'Category page slot structure from category-config.js.

HIERARCHY:
page_header (root)
├── breadcrumbs_content
├── category_title
└── category_description

filters_container (col 1-3)
├── filters_above_cms
├── filter_heading
├── active_filters
├── layered_navigation
└── filters_below_cms

products_container (col 4-12)
├── mobile_filter_toggle (mobile only)
├── sorting_controls
│   ├── product_count_info
│   ├── sort_selector
│   └── view_mode_toggle
├── products_above_cms
├── product_items (product grid)
│   └── product_card_template (repeated)
│       ├── product_card_image
│       └── product_card_content
│           ├── product_card_name
│           ├── product_card_price_container
│           ├── product_card_stock_label
│           └── product_card_add_to_cart
├── products_below_cms
└── pagination_container

PRODUCT CARD TEMPLATE:
The product_card_template is repeated for each product.
Child slots get instance IDs: product_card_name_0, product_card_name_1, etc.
Edit template slots to change all product cards.',
'core', '["category", "hierarchy", "structure", "product card", "filters"]', 90, 'developer', true),

-- ============================================
-- EDITOR SIDEBAR DOCUMENTATION
-- ============================================

('architecture', 'Editor Sidebar - Overview',
'The EditorSidebar is a fixed-position panel (320px wide) that appears when a slot element is selected in the visual editor.

LOCATION: src/components/editor/slot/EditorSidebar.jsx

KEY FEATURES:
- Real-time property editing
- XSS-protected HTML content editing
- Translation support with auto-translate
- Tailwind CSS class management
- Inline style application
- Dynamic specialized sidebars

SIDEBAR SECTIONS:
1. Content - Text and HTML editing
2. Size - Width/Height controls
3. Typography - Font size, bold, italic, alignment
4. Appearance - Text color, background color
5. Border - Border width, style, radius, color
6. Spacing - Padding and margin controls

VISIBILITY:
- Only shows when isSlotElement is true
- Checks for data-slot-id or data-editable attributes
- Specialized sidebars override default for specific slots

PROPS:
- selectedElement: DOM element being edited
- onClassChange: Callback for class/style changes
- onTextChange: Callback for content changes
- slotConfig: Current slot configuration from DB
- allSlots: All slots for context access',
'core', '["editor", "sidebar", "properties", "styling"]', 95, 'developer', true),

('architecture', 'Editor Sidebar - Specialized Sidebars',
'Specialized sidebars provide custom editing UI for specific slot types.

SIDEBAR REGISTRY (EditorSidebar.jsx):
```javascript
const SIDEBAR_COMPONENTS = {
  LayeredNavigationSidebar: () => import(''./sidebars/LayeredNavigationSidebar''),
  HeaderEditorSidebar: () => import(''./sidebars/HeaderEditorSidebar''),
};
```

ENABLING FOR A SLOT:
Set metadata.editorSidebar in slot config:
```javascript
layered_navigation: {
  id: ''layered_navigation'',
  type: ''component'',
  metadata: {
    editorSidebar: ''LayeredNavigationSidebar''
  }
}
```

HEADER EDITOR SIDEBAR:
- Sections: Header Container, Logo, Search Bar, Navigation, User Actions, Mobile Menu
- Controls: Logo upload, search styling, nav link colors, cart badge, mobile menu
- Target slots: header_main, store_logo, search_bar, navigation_bar, user_account_menu

LAYERED NAVIGATION SIDEBAR:
- Sections: Filter Heading, Filter Labels, Filter Options, Active Filters, Container
- Controls: Heading text/color, label styling, checkbox color, active filter badges
- Target slots: filter_heading, attribute_filter_label, filter_option_styles

CREATING NEW SPECIALIZED SIDEBAR:
1. Create component in ./sidebars/YourSidebar.jsx
2. Add to SIDEBAR_COMPONENTS map
3. Set metadata.editorSidebar in slot config
4. Component receives: slotId, slotConfig, allSlots, onClassChange, onTextChange',
'core', '["sidebar", "specialized", "header", "filters", "custom"]', 90, 'developer', true),

('architecture', 'Editor Sidebar - Content Section',
'Content section for editing text and HTML within slots.

TEXT CONTENT EDITING:
- Uncontrolled textarea for performance (no re-render lag)
- Auto-save on blur via handleTextContentSave
- Translation detection for i18n keys
- Auto-translate to all active languages

TRANSLATION SUPPORT:
```javascript
// Detects patterns like: {t("key")}, t("key"), or common.button.label
const detectTranslationKey = async (content) => {
  const tPattern = /\{?t\(["\"]([^"\"]+)["\"]\)\}?/;
  // Also does reverse lookup - text value → key
};
```

HTML CONTENT EDITING:
- XSS protection via parseEditorHtml()
- Security level: Editor (allows common HTML elements)
- Shows validation warnings if HTML was sanitized
- Extracts className, styles, and metadata from HTML

HIDE FOR SPECIAL SLOTS:
- styleOnly metadata hides content section
- readOnly metadata hides content section
- Used for product card slots where content is dynamic

TRANSLATABLE INDICATOR:
- Green border and Globe icon when content is translatable
- "Make Translatable" button converts text to translation key
- Auto-translates to all active languages on save',
'core', '["content", "text", "html", "translation", "xss"]', 85, 'developer', true),

('architecture', 'Editor Sidebar - Typography Section',
'Typography controls for font styling.

FONT SIZE:
Uses Tailwind text-* classes:
- text-xs, text-sm, text-base, text-lg
- text-xl, text-2xl, text-3xl, text-4xl

```javascript
const getCurrentFontSize = (className) => {
  const sizes = [''text-xs'', ''text-sm'', ''text-base'', ''text-lg'', ''text-xl'', ''text-2xl'', ''text-3xl'', ''text-4xl''];
  const found = sizes.find(size => className.includes(size));
  return found ? found.replace(''text-'', '''') : ''base'';
};
```

BOLD/ITALIC:
- Toggle buttons for font-bold/font-semibold
- Toggle for italic class
- Reads current state from className

TEXT ALIGNMENT:
- Left, Center, Right buttons
- Applies text-left, text-center, text-right
- Uses surgical class replacement (only changes alignment classes)

ALIGNMENT PERSISTENCE:
- Alignment stored in parentClassName for wrapper elements
- handleAlignmentChange finds correct target element
- Preserves inline styles and color classes during alignment changes

CLASS REPLACEMENT:
```javascript
const replaceSpecificClass = (classString, newClass, removePattern) => {
  const classes = classString.split('' '').filter(Boolean);
  const filteredClasses = classes.filter(cls => !removePattern.test(cls));
  if (newClass) filteredClasses.push(newClass);
  return filteredClasses.join('' '');
};
```',
'core', '["typography", "font", "alignment", "tailwind", "classes"]', 85, 'developer', true),

('architecture', 'Editor Sidebar - Appearance Section',
'Color and visual appearance controls.

TEXT COLOR:
- Color picker input (type="color")
- Hex input for precise values
- Converts RGB to hex for color picker compatibility

BACKGROUND COLOR:
- Same controls as text color
- Skips template variables ({{...}})
- Falls back to #ffffff for color picker

COLOR CONVERSION:
```javascript
// RGB to Hex conversion
if (computedValue.startsWith(''rgb'')) {
  const rgbMatch = computedValue.match(/\d+/g);
  if (rgbMatch && rgbMatch.length >= 3) {
    const hex = ''#'' + rgbMatch.slice(0, 3)
      .map(x => parseInt(x).toString(16).padStart(2, ''0''))
      .join('''');
  }
}
```

TAILWIND COLOR DETECTION:
- Explicit mapping for text-white, text-black
- Falls back to computed styles for other colors
- Preserves Tailwind color classes during edits

STYLE SOURCES (priority order):
1. Inline styles on element
2. Stored styles from slotConfig
3. Computed styles from DOM
4. Tailwind class detection',
'core', '["appearance", "color", "background", "hex", "rgb"]', 80, 'developer', true),

('architecture', 'Editor Sidebar - Border & Effects Section',
'Border styling and visual effects controls.

BORDER CONTROLS:
- Width: 0-10px numeric input
- Style: none, solid, dashed, dotted, double, groove, ridge, inset, outset
- Radius: 0-50px numeric input
- Color: Color picker + hex input

EFFECTS:
- Opacity: 0-1 with 0.1 step
- Z-Index: Numeric for layering
- Box Shadow: Preset options (none, small, medium, large, x-large)

LAYOUT CONTROLS:
- Display: block, inline, inline-block, flex, grid, none
- Position: static, relative, absolute, fixed, sticky

FLEX CONTROLS (when display=flex):
- Flex Direction: row, column, row-reverse, column-reverse
- Justify Content: start, center, end, space-between, space-around, space-evenly
- Align Items: stretch, start, center, end, baseline

BORDER PERSISTENCE:
```javascript
// Auto-set border style/color when width > 0
if (property === ''borderWidth'' && parseInt(formattedValue) > 0) {
  if (!saveStyles.borderStyle) saveStyles.borderStyle = targetElement.style.borderStyle;
  if (!saveStyles.borderColor) saveStyles.borderColor = targetElement.style.borderColor;
}
```',
'core', '["border", "effects", "shadow", "flex", "layout"]', 80, 'developer', true),

('architecture', 'Editor Sidebar - Size & Spacing Section',
'Dimension and spacing controls.

SIZE CONTROLS:
- Width: Numeric input with % unit
- Height: Numeric input with px unit (min-height)
- Quick Width buttons: Fit, 50%, 75%, 100%, 150%, 200%, 250%
- Auto Size: Resets to auto
- Fill: Sets width=100%, maxWidth=100%

SPECIAL WIDTH HANDLING:
- fit-content displays as read-only "fit-content"
- Percentage widths show numeric input with % suffix

PADDING CONTROLS:
- Visual grid layout (top, right, bottom, left, all)
- Center input sets padding (all sides)
- Individual inputs for each side

MARGIN CONTROLS:
- Same visual grid as padding
- Center input sets margin (all sides)
- Individual inputs for each side

PROPERTY FORMAT:
```javascript
// Numeric properties get unit suffix
if ([''width'', ''maxWidth'', ''minWidth''].includes(property)) {
  if (!value.includes(''%'') && !value.includes(''px'') && value !== ''auto'' && value !== ''fit-content'') {
    formattedValue = value + ''%'';
  }
}
```',
'core', '["size", "width", "height", "padding", "margin", "spacing"]', 80, 'developer', true),

('architecture', 'Editor Sidebar - Style Manager Integration',
'How EditorSidebar works with SimpleStyleManager for DOM updates.

STYLE MANAGER LOCATION:
src/components/editor/slot/SimpleStyleManager.js

PROPERTY CHANGE FLOW:
1. User changes property in sidebar
2. handlePropertyChange called
3. For Tailwind classes: styleManager.applyStyle()
4. For inline styles: direct DOM manipulation
5. onInlineClassChange callback to save to DB

CLASS-BASED PROPERTIES:
- fontSize → text-{size} class
- fontWeight → font-{weight} class
- fontStyle → italic class

INLINE STYLE PROPERTIES:
- color, backgroundColor, borderColor
- width, height, padding, margin
- borderWidth, borderStyle, borderRadius
- opacity, zIndex, boxShadow

SAVE FLOW:
```javascript
// EditorSidebar saves via callbacks
onInlineClassChange(slotId, className, styles, isAlignmentChange);
onTextChange(slotId, content);

// Parent (CartSlotsEditor) handles DB save
// Uses SaveManager for batching
```

WRAPPER CLASS FILTERING:
```javascript
// Classes that should NOT be saved
const isWrapperOrEditorClass = (cls) => {
  if ([''border-2'', ''border-blue-500'', ''border-dashed''].includes(cls)) return true;
  if ([''cursor-grab'', ''transition-all''].includes(cls)) return true;
  if (cls.match(/^p-\d+$/)) return true; // Wrapper padding
  return false;
};
```',
'core', '["style manager", "dom", "save", "callbacks", "tailwind"]', 85, 'developer', true),

('architecture', 'Editor Sidebar - Product Card Template Mirroring',
'How changes to product card instances sync with the template.

TEMPLATE MIRRORING:
When editing a product card instance (product_card_name_0), changes mirror to template.

DETECTION:
```javascript
// Check if slot ID has instance suffix (_N)
let baseTemplateId = elementSlotId.replace(/_\d+$/, '''');

// Special case: product_card_N → product_card_template
if (baseTemplateId === ''product_card'') {
  baseTemplateId = ''product_card_template'';
}
```

SAVE ORDER:
1. Save to base template FIRST
2. Save to current instance SECOND
```javascript
if (baseTemplateId !== elementSlotId) {
  onInlineClassChange(baseTemplateId, classNameForSave, saveStyles);
}
onInlineClassChange(elementSlotId, classNameForSave, saveStyles);
```

METADATA FLAGS:
- styleOnly: true - Content section hidden (product cards)
- readOnly: true - Content section hidden
- textOnly: true - HTML editor hidden

WHY TEMPLATE FIRST:
- Ensures template has latest styles
- Instance inherits from template
- Prevents race conditions in rendering',
'core', '["product card", "template", "mirroring", "instance"]', 85, 'developer', true);

-- Update usage counts for patterns
UPDATE ai_code_patterns SET usage_count = 5 WHERE pattern_type = 'css';
UPDATE ai_code_patterns SET usage_count = 3 WHERE pattern_type = 'database';
UPDATE ai_plugin_examples SET usage_count = 10 WHERE slug = 'countdown-timer';
UPDATE ai_plugin_examples SET usage_count = 8 WHERE slug = 'newsletter-popup';
