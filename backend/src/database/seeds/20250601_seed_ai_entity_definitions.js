/**
 * Seed: AI Entity Definitions
 * Populate entity schemas for all admin entities AI can interact with
 */

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const now = new Date();

    const entityDefinitions = [
      // === PRODUCT MANAGEMENT ===
      {
        entity_name: 'product_tabs',
        display_name: 'Product Tabs',
        description: 'Tabs displayed on product detail pages (Specifications, Description, Reviews, etc.)',
        table_name: 'product_tabs',
        related_tables: JSON.stringify([
          { name: 'product_tab_translations', relation_type: 'one_to_many', foreign_key: 'tab_id' }
        ]),
        supported_operations: JSON.stringify(['list', 'get', 'create', 'update', 'delete']),
        fields: JSON.stringify([
          { name: 'id', type: 'uuid', required: false, description: 'Unique identifier', ai_hints: 'Auto-generated' },
          { name: 'name', type: 'string', required: true, description: 'Tab name displayed to customers', ai_hints: 'User-visible label' },
          { name: 'slug', type: 'string', required: false, description: 'URL-friendly identifier', ai_hints: 'Auto-generated from name' },
          { name: 'tab_type', type: 'enum', required: true, description: 'Type of content', ai_hints: 'text, description, attributes, attribute_sets', values: ['text', 'description', 'attributes', 'attribute_sets'] },
          { name: 'content', type: 'text', required: false, description: 'Tab content (for text type)', ai_hints: 'HTML or markdown content' },
          { name: 'sort_order', type: 'integer', required: false, description: 'Display order', ai_hints: 'Lower numbers appear first' },
          { name: 'is_active', type: 'boolean', required: false, description: 'Whether tab is visible', ai_hints: 'true/false' }
        ]),
        intent_keywords: JSON.stringify(['tab', 'tabs', 'product tab', 'specifications', 'specs', 'description tab', 'rename tab', 'tab name']),
        example_prompts: JSON.stringify([
          'rename the specs tab to Technical Details',
          'change product tab Specifications to myhamid',
          'add a new tab called Reviews',
          'hide the description tab',
          'reorder product tabs'
        ]),
        example_responses: JSON.stringify([
          'I\'ve renamed the "Specifications" tab to "Technical Details". The change is now live on your product pages.',
          'Done! The tab has been renamed from "Specifications" to "myhamid".',
          'I\'ve created a new "Reviews" tab. You can now add content to it in the admin panel.'
        ]),
        api_endpoint: '/api/product-tabs',
        category: 'products',
        priority: 80,
        requires_confirmation: false,
        is_destructive: true,
        is_active: true,
        created_at: now,
        updated_at: now
      },

      // === SEO SETTINGS ===
      {
        entity_name: 'seo_settings',
        display_name: 'SEO Settings',
        description: 'Store-wide SEO configuration including meta tags, robots settings, and sitemap options',
        table_name: 'seo_settings',
        related_tables: JSON.stringify([]),
        supported_operations: JSON.stringify(['get', 'update']),
        fields: JSON.stringify([
          { name: 'meta_title_suffix', type: 'string', required: false, description: 'Appended to all page titles', ai_hints: 'e.g., " | My Store"' },
          { name: 'default_meta_description', type: 'text', required: false, description: 'Default description for pages without custom', ai_hints: 'Max 160 chars recommended' },
          { name: 'default_meta_keywords', type: 'text', required: false, description: 'Default keywords', ai_hints: 'Comma-separated list' },
          { name: 'robots_index', type: 'boolean', required: false, description: 'Allow search engine indexing', ai_hints: 'true = index, false = noindex' },
          { name: 'robots_follow', type: 'boolean', required: false, description: 'Allow following links', ai_hints: 'true = follow, false = nofollow' },
          { name: 'sitemap_enabled', type: 'boolean', required: false, description: 'Enable sitemap generation', ai_hints: 'true/false' },
          { name: 'structured_data_enabled', type: 'boolean', required: false, description: 'Enable JSON-LD structured data', ai_hints: 'Helps search engines understand content' }
        ]),
        intent_keywords: JSON.stringify(['seo', 'meta', 'title', 'description', 'keywords', 'robots', 'sitemap', 'search engine', 'google', 'indexing']),
        example_prompts: JSON.stringify([
          'update the SEO title suffix to " | Best Store"',
          'disable search engine indexing',
          'enable sitemap generation',
          'set default meta description to "Shop the best products online"'
        ]),
        example_responses: JSON.stringify([
          'I\'ve updated the SEO title suffix. All pages will now show " | Best Store" after their titles.',
          'Search engine indexing has been disabled. Your site will no longer appear in search results.',
          'Sitemap generation is now enabled. Search engines can now discover all your pages.'
        ]),
        api_endpoint: '/api/seo-settings',
        category: 'settings',
        priority: 70,
        requires_confirmation: true,
        is_destructive: false,
        is_active: true,
        created_at: now,
        updated_at: now
      },

      // === LANGUAGES ===
      {
        entity_name: 'languages',
        display_name: 'Store Languages',
        description: 'Languages available in the store for content and translations',
        table_name: 'languages',
        related_tables: JSON.stringify([]),
        supported_operations: JSON.stringify(['list', 'get', 'create', 'update', 'delete']),
        fields: JSON.stringify([
          { name: 'code', type: 'string', required: true, description: 'ISO language code', ai_hints: 'e.g., en, nl, fr, de' },
          { name: 'name', type: 'string', required: true, description: 'Language name in English', ai_hints: 'e.g., English, Dutch, French' },
          { name: 'native_name', type: 'string', required: false, description: 'Language name in native script', ai_hints: 'e.g., Nederlands, Français' },
          { name: 'is_default', type: 'boolean', required: false, description: 'Default store language', ai_hints: 'Only one can be default' },
          { name: 'is_active', type: 'boolean', required: false, description: 'Whether language is available', ai_hints: 'true/false' },
          { name: 'sort_order', type: 'integer', required: false, description: 'Display order in language selector', ai_hints: 'Lower = first' }
        ]),
        intent_keywords: JSON.stringify(['language', 'languages', 'locale', 'translation', 'multilingual', 'dutch', 'french', 'german', 'spanish', 'english']),
        example_prompts: JSON.stringify([
          'add French language to the store',
          'set Dutch as the default language',
          'disable German language',
          'list all active languages'
        ]),
        example_responses: JSON.stringify([
          'French (Français) has been added to your store. You can now start translating your content.',
          'Dutch is now the default language. Customers will see Dutch content by default.',
          'German has been disabled. It will no longer appear in the language selector.'
        ]),
        api_endpoint: '/api/languages',
        category: 'settings',
        priority: 75,
        requires_confirmation: false,
        is_destructive: true,
        is_active: true,
        created_at: now,
        updated_at: now
      },

      // === TRANSLATIONS ===
      {
        entity_name: 'translations',
        display_name: 'UI Translations',
        description: 'UI labels and text translations for the storefront',
        table_name: 'translations',
        related_tables: JSON.stringify([]),
        supported_operations: JSON.stringify(['list', 'get', 'update', 'create']),
        fields: JSON.stringify([
          { name: 'key', type: 'string', required: true, description: 'Translation key', ai_hints: 'e.g., cart.add_to_cart, product.price' },
          { name: 'language_code', type: 'string', required: true, description: 'Target language code', ai_hints: 'e.g., en, nl, fr' },
          { name: 'value', type: 'text', required: true, description: 'Translated text', ai_hints: 'The actual translation' },
          { name: 'category', type: 'string', required: false, description: 'Translation category', ai_hints: 'e.g., common, product, cart, checkout' }
        ]),
        intent_keywords: JSON.stringify(['translate', 'translation', 'label', 'text', 'wording', 'change text', 'button text', 'add to cart', 'buy now']),
        example_prompts: JSON.stringify([
          'translate "Add to Cart" to Dutch',
          'change the checkout button text to "Purchase Now"',
          'update the cart label to "Shopping Bag"'
        ]),
        example_responses: JSON.stringify([
          'The "Add to Cart" button has been translated to "Toevoegen aan winkelwagen" in Dutch.',
          'The checkout button now displays "Purchase Now" instead of "Checkout".'
        ]),
        api_endpoint: '/api/translations',
        category: 'content',
        priority: 85,
        requires_confirmation: false,
        is_destructive: false,
        is_active: true,
        created_at: now,
        updated_at: now
      },

      // === PAYMENT METHODS ===
      {
        entity_name: 'payment_methods',
        display_name: 'Payment Methods',
        description: 'Available payment methods in the store (Credit Card, PayPal, etc.)',
        table_name: 'payment_methods',
        related_tables: JSON.stringify([]),
        supported_operations: JSON.stringify(['list', 'get', 'update']),
        fields: JSON.stringify([
          { name: 'code', type: 'string', required: true, description: 'Payment method code', ai_hints: 'e.g., credit_card, paypal, stripe' },
          { name: 'name', type: 'string', required: true, description: 'Display name', ai_hints: 'Shown at checkout' },
          { name: 'is_active', type: 'boolean', required: false, description: 'Whether method is available', ai_hints: 'true/false' },
          { name: 'sort_order', type: 'integer', required: false, description: 'Display order at checkout', ai_hints: 'Lower = first' },
          { name: 'min_order_total', type: 'decimal', required: false, description: 'Minimum order amount', ai_hints: 'In store currency' },
          { name: 'max_order_total', type: 'decimal', required: false, description: 'Maximum order amount', ai_hints: 'In store currency' }
        ]),
        intent_keywords: JSON.stringify(['payment', 'pay', 'credit card', 'paypal', 'stripe', 'checkout payment', 'enable payment', 'disable payment']),
        example_prompts: JSON.stringify([
          'enable PayPal payments',
          'disable credit card payments',
          'set minimum order for PayPal to $50'
        ]),
        example_responses: JSON.stringify([
          'PayPal is now enabled. Customers can pay with their PayPal account at checkout.',
          'Credit card payments have been disabled.'
        ]),
        api_endpoint: '/api/payment-methods',
        category: 'settings',
        priority: 70,
        requires_confirmation: true,
        is_destructive: false,
        is_active: true,
        created_at: now,
        updated_at: now
      },

      // === SHIPPING METHODS ===
      {
        entity_name: 'shipping_methods',
        display_name: 'Shipping Methods',
        description: 'Shipping options available to customers',
        table_name: 'shipping_methods',
        related_tables: JSON.stringify([
          { name: 'shipping_rates', relation_type: 'one_to_many', foreign_key: 'method_id' }
        ]),
        supported_operations: JSON.stringify(['list', 'get', 'create', 'update', 'delete']),
        fields: JSON.stringify([
          { name: 'name', type: 'string', required: true, description: 'Shipping method name', ai_hints: 'e.g., Standard Shipping, Express Delivery' },
          { name: 'code', type: 'string', required: true, description: 'Unique code', ai_hints: 'e.g., standard, express, free' },
          { name: 'base_rate', type: 'decimal', required: false, description: 'Base shipping cost', ai_hints: 'In store currency' },
          { name: 'free_shipping_threshold', type: 'decimal', required: false, description: 'Order amount for free shipping', ai_hints: 'Set to 0 for always free' },
          { name: 'estimated_days_min', type: 'integer', required: false, description: 'Minimum delivery days', ai_hints: 'e.g., 3' },
          { name: 'estimated_days_max', type: 'integer', required: false, description: 'Maximum delivery days', ai_hints: 'e.g., 5' },
          { name: 'is_active', type: 'boolean', required: false, description: 'Whether method is available', ai_hints: 'true/false' }
        ]),
        intent_keywords: JSON.stringify(['shipping', 'delivery', 'ship', 'shipping rate', 'free shipping', 'express', 'standard shipping']),
        example_prompts: JSON.stringify([
          'set free shipping for orders over $100',
          'add express shipping option',
          'change shipping rate to $5.99',
          'disable international shipping'
        ]),
        example_responses: JSON.stringify([
          'Free shipping is now available for orders over $100.',
          'Express shipping has been added with 1-2 day delivery.'
        ]),
        api_endpoint: '/api/shipping',
        category: 'settings',
        priority: 70,
        requires_confirmation: false,
        is_destructive: true,
        is_active: true,
        created_at: now,
        updated_at: now
      },

      // === CATEGORIES ===
      {
        entity_name: 'categories',
        display_name: 'Product Categories',
        description: 'Product categories for organizing the catalog',
        table_name: 'categories',
        related_tables: JSON.stringify([
          { name: 'category_translations', relation_type: 'one_to_many', foreign_key: 'category_id' }
        ]),
        supported_operations: JSON.stringify(['list', 'get', 'create', 'update', 'delete']),
        fields: JSON.stringify([
          { name: 'name', type: 'string', required: true, description: 'Category name', ai_hints: 'Displayed in navigation' },
          { name: 'slug', type: 'string', required: false, description: 'URL-friendly identifier', ai_hints: 'Auto-generated from name' },
          { name: 'description', type: 'text', required: false, description: 'Category description', ai_hints: 'Shown on category page' },
          { name: 'parent_id', type: 'uuid', required: false, description: 'Parent category', ai_hints: 'For subcategories' },
          { name: 'image_url', type: 'string', required: false, description: 'Category image', ai_hints: 'URL to image' },
          { name: 'sort_order', type: 'integer', required: false, description: 'Display order', ai_hints: 'Lower = first' },
          { name: 'is_active', type: 'boolean', required: false, description: 'Whether category is visible', ai_hints: 'true/false' }
        ]),
        intent_keywords: JSON.stringify(['category', 'categories', 'product category', 'subcategory', 'catalog', 'organize products', 'root category', 'main category', 'top level category']),
        example_prompts: JSON.stringify([
          'create a new category called "Summer Collection"',
          'rename Electronics to Consumer Electronics',
          'add subcategory Laptops under Electronics',
          'hide the Clearance category',
          'create a root category called "Test Category"',
          'add a top level category named "New Arrivals"',
          'create a main category for seasonal items'
        ]),
        example_responses: JSON.stringify([
          'Created the "Summer Collection" category. You can now assign products to it.',
          'Renamed "Electronics" to "Consumer Electronics".',
          'Created "Test Category" as a root category. It will appear in the main navigation.',
          'Created "New Arrivals" as a top-level category. Products can now be assigned to it.'
        ]),
        api_endpoint: '/api/categories',
        category: 'products',
        priority: 80,
        requires_confirmation: false,
        is_destructive: true,
        is_active: true,
        created_at: now,
        updated_at: now
      },

      // === ATTRIBUTES ===
      {
        entity_name: 'attributes',
        display_name: 'Product Attributes',
        description: 'Custom product attributes (Size, Color, Material, etc.)',
        table_name: 'attributes',
        related_tables: JSON.stringify([
          { name: 'attribute_options', relation_type: 'one_to_many', foreign_key: 'attribute_id' }
        ]),
        supported_operations: JSON.stringify(['list', 'get', 'create', 'update', 'delete']),
        fields: JSON.stringify([
          { name: 'name', type: 'string', required: true, description: 'Attribute name', ai_hints: 'e.g., Size, Color, Material' },
          { name: 'code', type: 'string', required: true, description: 'Unique code', ai_hints: 'e.g., size, color' },
          { name: 'type', type: 'enum', required: true, description: 'Attribute type', ai_hints: 'text, select, multiselect, boolean, number', values: ['text', 'select', 'multiselect', 'boolean', 'number'] },
          { name: 'is_filterable', type: 'boolean', required: false, description: 'Show in layered navigation', ai_hints: 'true = customers can filter by this' },
          { name: 'is_visible', type: 'boolean', required: false, description: 'Show on product page', ai_hints: 'true/false' },
          { name: 'is_required', type: 'boolean', required: false, description: 'Required for products', ai_hints: 'true/false' }
        ]),
        intent_keywords: JSON.stringify(['attribute', 'attributes', 'product attribute', 'size', 'color', 'material', 'specification', 'filter']),
        example_prompts: JSON.stringify([
          'add a new attribute called "Brand"',
          'make Color filterable',
          'add options S, M, L, XL to Size attribute',
          'rename Material to Fabric'
        ]),
        example_responses: JSON.stringify([
          'Created the "Brand" attribute. You can now assign brand values to products.',
          'Color is now filterable. Customers can filter products by color in the category pages.'
        ]),
        api_endpoint: '/api/attributes',
        category: 'products',
        priority: 75,
        requires_confirmation: false,
        is_destructive: true,
        is_active: true,
        created_at: now,
        updated_at: now
      },

      // === CMS PAGES ===
      {
        entity_name: 'cms_pages',
        display_name: 'CMS Pages',
        description: 'Static content pages (About Us, Contact, Terms, etc.)',
        table_name: 'cms_pages',
        related_tables: JSON.stringify([
          { name: 'cms_page_translations', relation_type: 'one_to_many', foreign_key: 'page_id' }
        ]),
        supported_operations: JSON.stringify(['list', 'get', 'create', 'update', 'delete']),
        fields: JSON.stringify([
          { name: 'title', type: 'string', required: true, description: 'Page title', ai_hints: 'Shown in browser tab and as heading' },
          { name: 'slug', type: 'string', required: true, description: 'URL path', ai_hints: 'e.g., about-us, contact' },
          { name: 'content', type: 'text', required: false, description: 'Page content', ai_hints: 'HTML content' },
          { name: 'meta_title', type: 'string', required: false, description: 'SEO title', ai_hints: 'For search engines' },
          { name: 'meta_description', type: 'text', required: false, description: 'SEO description', ai_hints: 'For search engines' },
          { name: 'is_active', type: 'boolean', required: false, description: 'Whether page is published', ai_hints: 'true/false' }
        ]),
        intent_keywords: JSON.stringify(['page', 'cms', 'content page', 'about', 'contact', 'terms', 'privacy', 'static page']),
        example_prompts: JSON.stringify([
          'create an About Us page',
          'update the Contact page content',
          'add SEO description to Terms page',
          'publish the FAQ page'
        ]),
        example_responses: JSON.stringify([
          'Created the "About Us" page. It\'s accessible at /about-us.',
          'Updated the Contact page content.'
        ]),
        api_endpoint: '/api/cms',
        category: 'content',
        priority: 70,
        requires_confirmation: false,
        is_destructive: true,
        is_active: true,
        created_at: now,
        updated_at: now
      },

      // === COUPONS ===
      {
        entity_name: 'coupons',
        display_name: 'Discount Coupons',
        description: 'Promotional discount codes and coupons',
        table_name: 'coupons',
        related_tables: JSON.stringify([]),
        supported_operations: JSON.stringify(['list', 'get', 'create', 'update', 'delete']),
        fields: JSON.stringify([
          { name: 'code', type: 'string', required: true, description: 'Coupon code', ai_hints: 'e.g., SUMMER20, FREESHIP' },
          { name: 'description', type: 'string', required: false, description: 'Internal description', ai_hints: 'For admin reference' },
          { name: 'discount_type', type: 'enum', required: true, description: 'Type of discount', ai_hints: 'percentage, fixed_amount, free_shipping', values: ['percentage', 'fixed_amount', 'free_shipping'] },
          { name: 'discount_value', type: 'decimal', required: false, description: 'Discount amount', ai_hints: '20 for 20% or $20' },
          { name: 'min_order_amount', type: 'decimal', required: false, description: 'Minimum order to apply', ai_hints: 'In store currency' },
          { name: 'max_uses', type: 'integer', required: false, description: 'Total uses allowed', ai_hints: 'null = unlimited' },
          { name: 'uses_per_customer', type: 'integer', required: false, description: 'Uses per customer', ai_hints: 'null = unlimited' },
          { name: 'valid_from', type: 'date', required: false, description: 'Start date', ai_hints: 'When coupon becomes active' },
          { name: 'valid_until', type: 'date', required: false, description: 'End date', ai_hints: 'When coupon expires' },
          { name: 'is_active', type: 'boolean', required: false, description: 'Whether coupon is active', ai_hints: 'true/false' }
        ]),
        intent_keywords: JSON.stringify(['coupon', 'discount', 'promo', 'promotion', 'discount code', 'voucher', 'sale', 'offer']),
        example_prompts: JSON.stringify([
          'create a 20% off coupon called SUMMER20',
          'add a free shipping coupon for orders over $50',
          'disable the FLASH10 coupon',
          'extend HOLIDAY coupon until January 15'
        ]),
        example_responses: JSON.stringify([
          'Created coupon "SUMMER20" for 20% off all orders.',
          'Created free shipping coupon. Customers with orders over $50 can use it.'
        ]),
        api_endpoint: '/api/coupons',
        category: 'marketing',
        priority: 75,
        requires_confirmation: false,
        is_destructive: true,
        is_active: true,
        created_at: now,
        updated_at: now
      },

      // === EMAIL TEMPLATES ===
      {
        entity_name: 'email_templates',
        display_name: 'Email Templates',
        description: 'Transactional email templates (Order Confirmation, Shipping, etc.)',
        table_name: 'email_templates',
        related_tables: JSON.stringify([]),
        supported_operations: JSON.stringify(['list', 'get', 'update']),
        fields: JSON.stringify([
          { name: 'code', type: 'string', required: true, description: 'Template code', ai_hints: 'e.g., order_confirmation, shipping_notification' },
          { name: 'name', type: 'string', required: true, description: 'Template name', ai_hints: 'For admin reference' },
          { name: 'subject', type: 'string', required: true, description: 'Email subject', ai_hints: 'Can use variables like {{order_number}}' },
          { name: 'body_html', type: 'text', required: true, description: 'HTML body', ai_hints: 'Email content with variables' },
          { name: 'body_text', type: 'text', required: false, description: 'Plain text body', ai_hints: 'Fallback for non-HTML clients' },
          { name: 'is_active', type: 'boolean', required: false, description: 'Whether template is used', ai_hints: 'true/false' }
        ]),
        intent_keywords: JSON.stringify(['email', 'email template', 'order email', 'confirmation email', 'shipping email', 'notification']),
        example_prompts: JSON.stringify([
          'update the order confirmation email subject',
          'add company logo to shipping notification email',
          'change the footer text in all emails'
        ]),
        example_responses: JSON.stringify([
          'Updated the order confirmation email subject.',
          'Added the logo to the shipping notification template.'
        ]),
        api_endpoint: '/api/email-templates',
        category: 'settings',
        priority: 65,
        requires_confirmation: true,
        is_destructive: false,
        is_active: true,
        created_at: now,
        updated_at: now
      },

      // === STORE SETTINGS ===
      {
        entity_name: 'store_settings',
        display_name: 'Store Settings',
        description: 'General store configuration (name, currency, timezone, etc.)',
        table_name: 'store_settings',
        related_tables: JSON.stringify([]),
        supported_operations: JSON.stringify(['get', 'update']),
        fields: JSON.stringify([
          { name: 'store_name', type: 'string', required: true, description: 'Store name', ai_hints: 'Displayed in header and emails' },
          { name: 'store_email', type: 'string', required: true, description: 'Store contact email', ai_hints: 'For customer inquiries' },
          { name: 'store_phone', type: 'string', required: false, description: 'Store phone number', ai_hints: 'For customer contact' },
          { name: 'store_address', type: 'text', required: false, description: 'Physical address', ai_hints: 'For invoices and contact page' },
          { name: 'currency', type: 'string', required: true, description: 'Store currency', ai_hints: 'e.g., USD, EUR, GBP' },
          { name: 'timezone', type: 'string', required: true, description: 'Store timezone', ai_hints: 'e.g., America/New_York, Europe/Amsterdam' },
          { name: 'date_format', type: 'string', required: false, description: 'Date display format', ai_hints: 'e.g., MM/DD/YYYY, DD-MM-YYYY' },
          { name: 'weight_unit', type: 'string', required: false, description: 'Weight unit', ai_hints: 'kg or lb' },
          { name: 'dimension_unit', type: 'string', required: false, description: 'Dimension unit', ai_hints: 'cm or in' }
        ]),
        intent_keywords: JSON.stringify(['store', 'settings', 'configuration', 'store name', 'currency', 'timezone', 'email', 'phone', 'address']),
        example_prompts: JSON.stringify([
          'change the store name to "My Awesome Store"',
          'set the currency to EUR',
          'update the store email to support@mystore.com',
          'change timezone to Pacific Time'
        ]),
        example_responses: JSON.stringify([
          'Updated the store name to "My Awesome Store". This will appear in the header and all emails.',
          'Currency changed to EUR. Product prices will now display in Euros.'
        ]),
        api_endpoint: '/api/stores/settings',
        category: 'settings',
        priority: 90,
        requires_confirmation: true,
        is_destructive: false,
        is_active: true,
        created_at: now,
        updated_at: now
      },

      // === TAX SETTINGS ===
      {
        entity_name: 'tax_settings',
        display_name: 'Tax Configuration',
        description: 'Tax rates and rules for different regions',
        table_name: 'tax_rates',
        related_tables: JSON.stringify([]),
        supported_operations: JSON.stringify(['list', 'get', 'create', 'update', 'delete']),
        fields: JSON.stringify([
          { name: 'name', type: 'string', required: true, description: 'Tax rate name', ai_hints: 'e.g., Standard VAT, Reduced Rate' },
          { name: 'rate', type: 'decimal', required: true, description: 'Tax percentage', ai_hints: 'e.g., 21 for 21%' },
          { name: 'country', type: 'string', required: false, description: 'Country code', ai_hints: 'ISO code: US, NL, DE' },
          { name: 'region', type: 'string', required: false, description: 'State/region', ai_hints: 'e.g., CA, NY, or null for country-wide' },
          { name: 'is_active', type: 'boolean', required: false, description: 'Whether rate is applied', ai_hints: 'true/false' }
        ]),
        intent_keywords: JSON.stringify(['tax', 'vat', 'tax rate', 'sales tax', 'taxation']),
        example_prompts: JSON.stringify([
          'set VAT rate to 21%',
          'add 9% tax for California',
          'disable tax for UK orders'
        ]),
        example_responses: JSON.stringify([
          'VAT rate updated to 21%. This will apply to all applicable orders.',
          'Added 9% sales tax for California customers.'
        ]),
        api_endpoint: '/api/tax',
        category: 'settings',
        priority: 65,
        requires_confirmation: true,
        is_destructive: false,
        is_active: true,
        created_at: now,
        updated_at: now
      }
    ];

    await queryInterface.bulkInsert('ai_entity_definitions', entityDefinitions);

    console.log('AI Entity Definitions seeded successfully');
    console.log(`  - ${entityDefinitions.length} entity definitions created`);
    console.log('  - Categories: products, settings, content, marketing');
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.bulkDelete('ai_entity_definitions', null, {});
    console.log('AI Entity Definitions seed data removed');
  }
};
