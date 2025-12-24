-- ============================================
-- TENANT DATABASE SEED DATA
-- Default data for new tenant databases
-- Auto-generated from existing database
-- ============================================

-- Tables with seed data:
--   - admin_navigation_registry
--   - categories
--   - category_translations
--   - cms_pages
--   - cms_page_translations
--   - cookie_consent_settings
--   - cookie_consent_settings_translations
--   - email_templates
--   - email_template_translations
--   - languages
--   - payment_methods
--   - payment_method_translations
--   - pdf_templates
--   - pdf_template_translations
--   - shipping_methods
--   - shipping_method_translations
--   - translations

-- ============================================
-- SEED DATA
-- ============================================

-- admin_navigation_registry
-- Order scheme: Top-level = 10, 20, 30... | Children = 1, 2, 3...
INSERT INTO admin_navigation_registry (id, key, label, icon, route, parent_key, order_position, is_core, is_visible, plugin_id, category, required_permission, description, badge_config, created_at, updated_at, type)
VALUES
  -- =============================================
  -- TOP-LEVEL NAVIGATION (order_position: 10, 20, 30...)
  -- =============================================
  ('e07959cb-4083-428a-a68f-185f845f9e2d', 'catalog', 'Catalog', 'Package', NULL, NULL, 20, true, true, NULL, NULL, NULL, NULL, NULL, NOW(), NOW(), 'standard'),
  ('6c05b36b-b525-4d55-81fe-b8857ed21572', 'sales', 'Sales', 'Receipt', NULL, NULL, 30, true, true, NULL, NULL, NULL, NULL, NULL, NOW(), NOW(), 'standard'),
  ('63e01829-d4b6-4e8e-a7f2-9578d4c7f394', 'content', 'Content', 'FileText', NULL, NULL, 40, true, true, NULL, NULL, NULL, NULL, NULL, NOW(), NOW(), 'standard'),
  ('8ed2a4ed-f089-4d31-907c-4890a0fe3f93', 'marketing', 'Marketing', 'Megaphone', NULL, NULL, 50, true, true, NULL, NULL, NULL, NULL, NULL, NOW(), NOW(), 'standard'),
  ('245a141f-f41b-4e1c-9030-639681b0ac7d', 'import_export', 'Import & Export', 'Upload', NULL, NULL, 60, true, true, NULL, NULL, NULL, NULL, NULL, NOW(), NOW(), 'standard'),
  ('458e07de-a8b2-401a-91bb-bcb4bab85456', 'seo', 'SEO', 'Search', NULL, NULL, 70, true, true, NULL, NULL, NULL, NULL, NULL, NOW(), NOW(), 'standard'),
  ('c8478891-a228-42c7-bf48-df2543ac9536', 'layout', 'Layout', 'Megaphone', NULL, NULL, 80, true, true, NULL, NULL, NULL, NULL, NULL, NOW(), NOW(), 'standard'),
  ('ffb70e1a-6d90-46bd-a890-7837404ff1ab', 'store', 'Store', 'Store', NULL, NULL, 90, true, true, NULL, NULL, NULL, NULL, NULL, NOW(), NOW(), 'standard'),
  ('a1b2c3d4-e5f6-7890-abcd-000000000001', 'advanced', 'Advanced', 'Settings', NULL, NULL, 100, true, false, NULL, NULL, NULL, 'Advanced settings and tools', NULL, NOW(), NOW(), 'standard'),

  -- =============================================
  -- CATALOG CHILDREN (parent: catalog, order: 1, 2, 3...)
  -- =============================================
  ('be829aa4-6a01-4db3-a73d-c7d105f838f1', 'products', 'Products', 'Package', '/admin/products', 'catalog', 1, true, true, NULL, 'catalog', NULL, NULL, NULL, NOW(), NOW(), 'standard'),
  ('0e599da5-acb3-42b9-95f3-40bec8114ecf', 'categories', 'Categories', 'Tag', '/admin/categories', 'catalog', 2, true, true, NULL, 'catalog', NULL, NULL, NULL, NOW(), NOW(), 'standard'),
  ('29f2a22b-fa56-466b-80fe-5f970db59f39', 'attributes', 'Attributes', 'Box', '/admin/attributes', 'catalog', 3, true, true, NULL, 'catalog', NULL, NULL, NULL, NOW(), NOW(), 'standard'),
  ('0668a4f5-529c-4e15-b230-e3ae93f3aeb7', 'custom_option_rules', 'Custom Options', 'Settings', '/admin/custom-option-rules', 'catalog', 4, true, true, NULL, 'catalog', NULL, NULL, NULL, NOW(), NOW(), 'standard'),
  ('5025c86d-8955-4c4d-a67a-78212e0e7182', 'product_tabs', 'Product Tabs', 'FileText', '/admin/product-tabs', 'catalog', 5, true, true, NULL, 'catalog', NULL, NULL, NULL, NOW(), NOW(), 'standard'),
  ('2036d4dc-cbb7-4587-95bf-5dbfea2741dc', 'product_labels', 'Product Labels', 'Tag', '/admin/product-labels', 'catalog', 6, true, true, NULL, 'catalog', NULL, NULL, NULL, NOW(), NOW(), 'standard'),
  ('0a442ac7-a056-4da4-9f40-902c5a41bd00', 'stock_settings', 'Stock Settings', 'Package', '/admin/stock-settings', 'catalog', 7, true, true, NULL, 'catalog', NULL, NULL, NULL, NOW(), NOW(), 'standard'),

  -- =============================================
  -- SALES CHILDREN (parent: sales, order: 1, 2, 3...)
  -- =============================================
  ('5bfea719-f62a-40e4-ba87-9259fb295e99', 'sales-settings', 'Settings', 'SettingsIcon', '/admin/sales-settings', 'sales', 1, true, true, NULL, 'main', NULL, NULL, NULL, NOW(), NOW(), 'standard'),
  ('34efb882-144a-4177-90a4-0da9312baef7', 'orders', 'Orders', 'Receipt', '/admin/orders', 'sales', 2, true, true, NULL, 'sales', NULL, NULL, NULL, NOW(), NOW(), 'standard'),
  ('6d782a02-a782-44dd-9721-552701e55571', 'customers', 'Customers', 'Users', '/admin/customers', 'sales', 3, true, true, NULL, 'sales', NULL, NULL, NULL, NOW(), NOW(), 'standard'),
  ('9c18f251-f391-47aa-84ba-8c155f07e808', 'tax', 'Tax', 'DollarSign', '/admin/tax', 'sales', 4, true, true, NULL, 'sales', NULL, NULL, NULL, NOW(), NOW(), 'standard'),
  ('e8f92e5e-0e96-4b4d-bf43-25fea085035a', 'blacklist', 'Blacklist', 'Shield', '/admin/blacklist', 'sales', 5, true, true, NULL, 'main', NULL, NULL, NULL, NOW(), NOW(), 'standard'),
  ('f00b2a6d-21c6-44bb-bead-2d773a097c42', 'shipping_methods', 'Shipping Methods', 'Truck', '/admin/shipping-methods', 'sales', 6, true, true, NULL, 'sales', NULL, NULL, NULL, NOW(), NOW(), 'standard'),
  ('f2237ccf-8449-42f3-ad6e-8ef6773e0010', 'payment_methods', 'Payment Methods', 'CreditCard', '/admin/payment-methods', 'sales', 7, true, true, NULL, 'sales', NULL, NULL, NULL, NOW(), NOW(), 'standard'),
  ('ba916985-a696-4fbd-998c-df7cffa7ed28', 'coupons', 'Coupons', 'Ticket', '/admin/coupons', 'sales', 8, true, true, NULL, 'sales', NULL, NULL, NULL, NOW(), NOW(), 'standard'),
  ('9e88d83f-3820-47ac-9138-7c7bc381ee41', 'delivery_settings', 'Delivery Settings', 'Calendar', '/admin/delivery-settings', 'sales', 9, true, true, NULL, 'sales', NULL, NULL, NULL, NOW(), NOW(), 'standard'),

  -- =============================================
  -- CONTENT CHILDREN (parent: content, order: 1, 2, 3...)
  -- =============================================
  ('9deae6d2-8b79-4961-9aa7-af5c420b530a', 'cms_pages', 'CMS Pages', 'FileText', '/admin/cms-pages', 'content', 1, true, true, NULL, 'content', NULL, NULL, NULL, NOW(), NOW(), 'standard'),
  ('19abe7de-a1d1-42ff-9da2-30ffb19c1e6b', 'cms_blocks', 'CMS Blocks', 'Square', '/admin/cms-blocks', 'content', 2, true, true, NULL, 'content', NULL, NULL, NULL, NOW(), NOW(), 'standard'),
  ('3d5d200b-a385-4f40-8ab0-6c234295cddc', 'file_library', 'File Library', 'Upload', '/admin/file-library', 'content', 3, true, true, NULL, 'content', NULL, NULL, NULL, NOW(), NOW(), 'standard'),
  ('250c4f0b-bcaf-45c6-b865-0967326f623d', 'emails', 'Emails', 'Mail', '/admin/emails', 'content', 4, true, true, NULL, 'content', NULL, NULL, NULL, NOW(), NOW(), 'standard'),

  -- =============================================
  -- MARKETING CHILDREN (parent: marketing, order: 1, 2, 3...)
  -- =============================================
  ('8971f94f-c30c-4029-8432-2696176ca16a', 'cookie_consent', 'Cookie Consent', 'Shield', '/admin/cookie-consent', 'marketing', 1, true, true, NULL, 'content', NULL, NULL, NULL, NOW(), NOW(), 'standard'),
  ('ef7e14a8-7cde-4635-ad0a-9186b32a7361', 'heatmaps', 'Heatmaps', 'Activity', '/admin/heatmaps', 'marketing', 2, true, true, NULL, 'marketing', NULL, NULL, NULL, NOW(), NOW(), 'premium'),
  ('6889bdcd-9849-4c7b-b26a-da08e4a9da25', 'ab_testing', 'A/B Testing', 'FlaskConical', '/admin/ab-testing', 'marketing', 3, true, true, NULL, 'marketing', NULL, NULL, NULL, NOW(), NOW(), 'standard'),
  ('bd22f10c-8b2e-4948-b306-431f2a97e7fd', 'customer_activity', 'Customer Activity', 'Users', '/admin/customer-activity', 'marketing', 4, true, true, NULL, 'marketing', NULL, NULL, NULL, NOW(), NOW(), 'standard'),
  ('621a4cd9-84e9-420b-82f8-b3b837b45059', 'analytics', 'Analytics', 'BarChart3', '/admin/analytics', 'marketing', 5, true, true, NULL, 'marketing', NULL, NULL, NULL, NOW(), NOW(), 'standard'),

  -- =============================================
  -- IMPORT & EXPORT CHILDREN (parent: import_export, order: 1, 2, 3...)
  -- =============================================
  ('571cf04b-2b04-428a-ad55-9192a56f7976', 'marketplace_hub', 'Marketplace Hub', 'ShoppingCart', '/admin/marketplace-hub', 'import_export', 1, true, true, NULL, 'import_export', NULL, 'Unified marketplace management: Amazon, eBay, and more with AI optimization', '{"text":"New","color":"blue","variant":"default"}'::jsonb, NOW(), NOW(), 'new'),
  ('0162fe04-d1b3-4871-a92a-be7d54afd002', 'shopify_integration', 'Shopify', 'ShoppingBag', '/admin/shopify-integration', 'import_export', 2, true, true, NULL, 'import_export', NULL, NULL, NULL, NOW(), NOW(), NULL),
  ('4a706191-0c65-48c4-8efa-f355454fab8e', 'akeneo_integration', 'Akeneo', 'Database', '/admin/akeneo-integration', 'import_export', 3, true, true, NULL, 'import_export', NULL, NULL, NULL, NOW(), NOW(), 'beta'),
  ('5415ee5a-1276-4883-ac01-33d3dfcb1c2b', 'import_export_jobs', 'Jobs & Analytics', 'BarChart3', '/admin/import-export-jobs', 'import_export', 4, true, true, NULL, 'import_export', NULL, 'Monitor import/export jobs and view performance analytics', NULL, NOW(), NOW(), NULL),

  -- =============================================
  -- SEO CHILDREN (parent: seo, order: 1, 2, 3...)
  -- =============================================
  ('067d4c9b-7823-4f64-be28-8c75450d231e', 'seo_settings', 'Global', 'Search', '/admin/seo-tools/settings', 'seo', 1, true, true, NULL, 'seo', NULL, NULL, NULL, NOW(), NOW(), 'standard'),
  ('dd08ce7f-b4ae-40dc-ae0a-e0e8667a9a2e', 'seo_templates', 'SEO Templates', 'FileText', '/admin/seo-tools/templates', 'seo', 2, true, true, NULL, 'seo', NULL, NULL, NULL, NOW(), NOW(), 'standard'),
  ('c4c35189-2da3-4062-a490-cab76a4cd967', 'seo_redirects', 'Redirects', 'RefreshCw', '/admin/seo-tools/redirects', 'seo', 3, true, true, NULL, 'seo', NULL, NULL, NULL, NOW(), NOW(), 'standard'),
  ('6d54e5c6-d6d8-4ea0-aa72-8eacc29f0f72', 'seo_canonical', 'Canonical URLs', 'Link', '/admin/seo-tools/canonical', 'seo', 4, true, true, NULL, 'seo', NULL, NULL, NULL, NOW(), NOW(), 'standard'),
  ('572c97b0-a00e-4a65-8a5d-e87036325e68', 'seo_hreflang', 'Hreflang', 'Globe', '/admin/seo-tools/hreflang', 'seo', 5, true, true, NULL, 'seo', NULL, NULL, NULL, NOW(), NOW(), 'standard'),
  ('c498373d-a513-4f78-b732-3c1933d181c9', 'seo_robots', 'Robots.txt', 'Bot', '/admin/seo-tools/robots', 'seo', 6, true, true, NULL, 'seo', NULL, NULL, NULL, NOW(), NOW(), 'standard'),
  ('c724b28d-e3bc-48ae-8707-87d585a7fe74', 'seo_social', 'Social Media', 'Share2', '/admin/seo-tools/social', 'seo', 7, true, true, NULL, 'seo', NULL, NULL, NULL, NOW(), NOW(), 'standard'),
  ('793535ce-1c1f-4c35-9cb0-24f05a52f047', 'xml_sitemap', 'XML Sitemap', 'FileCode', '/admin/xml-sitemap', 'seo', 8, true, true, NULL, 'seo', NULL, NULL, NULL, NOW(), NOW(), 'standard'),
  ('7ecc37c8-13fe-45a2-bded-0172da9184de', 'html_sitemap', 'HTML Sitemap', 'FileText', '/admin/html-sitemap', 'seo', 9, true, true, NULL, 'seo', NULL, NULL, NULL, NOW(), NOW(), 'standard'),
  ('86af5d49-7fb1-405e-a371-f627274772b5', 'seo_report', 'SEO Report', 'FileText', '/admin/seo-tools/report', 'seo', 10, true, true, NULL, 'seo', NULL, NULL, NULL, NOW(), NOW(), 'standard'),

  -- =============================================
  -- LAYOUT CHILDREN (parent: layout, order: 1, 2, 3...)
  -- =============================================
  ('237cfcb8-0464-44ab-916a-d2425f7bad73', 'theme_layout', 'Theme & Layout', 'Palette', '/admin/theme-layout', 'layout', 1, true, true, NULL, 'store', NULL, NULL, NULL, NOW(), NOW(), 'standard'),
  ('90e36469-b9e5-4a2b-8d7d-5fde01f066e9', 'translations', 'Translations', 'Globe', '/admin/translations', 'layout', 2, true, true, NULL, 'store', NULL, NULL, NULL, NOW(), NOW(), 'new'),

  -- =============================================
  -- STORE CHILDREN (parent: store, order: 1, 2, 3...)
  -- =============================================
  ('e4de6184-0894-409c-b819-58bd3a0539d5', 'settings', 'General Settings', 'Settings', '/admin/settings', 'store', 1, true, true, NULL, 'store', NULL, NULL, NULL, NOW(), NOW(), 'standard'),
  ('18727c04-a31b-4dc4-9b06-9d81a71beeee', 'database_integrations', 'Database', 'Database', '/admin/database-integrations', 'store', 2, true, true, NULL, 'store', NULL, NULL, NULL, NOW(), NOW(), 'standard'),
  ('93b2fb65-e369-4631-976a-35a764de7459', 'store_email', 'Email', 'Mail', '/admin/email', 'store', 3, true, true, NULL, 'store', NULL, NULL, NULL, NOW(), NOW(), 'standard'),
  ('31085f55-2a25-40ed-83ba-be0c80998b81', 'media_storage', 'Media Storage', 'Image', '/admin/media-storage', 'store', 4, true, true, NULL, 'store', NULL, NULL, NULL, NOW(), NOW(), 'standard'),
  ('ada124ce-e1a5-4d93-b071-0514350deda0', 'uptime-report', 'Uptime Report', 'Activity', '/admin/uptime-report', 'store', 5, true, true, NULL, 'store', NULL, 'Track daily charges and uptime for running stores', NULL, NOW(), NOW(), 'standard'),
  ('2e6e8b58-03e9-4ad2-9ecc-8051c343a269', 'custom_domains', 'Custom Domains', 'Globe', '/admin/custom-domains', 'store', 6, true, true, NULL, 'store', NULL, NULL, NULL, NOW(), NOW(), 'standard'),
  ('d15c2f9e-ce66-42a2-85fa-280f8f170f62', 'cache', 'Cache', 'Database', '/admin/cache', 'store', 7, true, true, NULL, 'store', NULL, NULL, NULL, NOW(), NOW(), 'standard'),
  ('b3f52d82-6591-4a20-9ed2-d2172c6fec54', 'background_jobs', 'Background Jobs', 'Activity', '/admin/background-jobs', 'store', 8, true, true, NULL, 'advanced', NULL, 'Monitor all background job processing and queue status', NULL, NOW(), NOW(), NULL)
ON CONFLICT DO NOTHING;

-- attribute_sets: Create 'Default' attribute set (store_id updated by provisioning service)
INSERT INTO attribute_sets (id, name, description, is_default, sort_order, store_id, attribute_ids, created_at, updated_at)
VALUES (gen_random_uuid(), 'Default', 'Default attribute set', true, 0, '{{STORE_ID}}', '[]'::jsonb, NOW(), NOW());

-- categories: Create 'root-catalog' category (store_id updated by provisioning service)
INSERT INTO categories (id, store_id, slug, sort_order, is_active, hide_in_menu, parent_id, level, created_at, updated_at)
VALUES (gen_random_uuid(), '{{STORE_ID}}', 'root-catalog', 0, true, false, NULL, 0, NOW(), NOW());

-- category_translations: Add translations for root-catalog
INSERT INTO category_translations (category_id, language_code, name, description, created_at, updated_at)
SELECT id, 'en', 'Root Catalog', 'Default root category for product catalog', NOW(), NOW()
FROM categories WHERE slug = 'root-catalog';

-- cms_pages (3 rows)
INSERT INTO cms_pages (id, slug, is_active, meta_title, meta_description, meta_keywords, meta_robots_tag, store_id, related_product_ids, published_at, sort_order, created_at, updated_at, is_system, seo)
VALUES
  ('bbb26804-4ff2-4e8b-ba2b-e8c203704176', '404-page-not-found', true, '404 - Page Not Found | {{store_name}}', 'Sorry, we couldn''t find the page you''re looking for. Browse our products or contact us for assistance.', '404, page not found, error, help', 'noindex, nofollow', '{{STORE_ID}}', '[]'::jsonb, NULL, 0, '2025-08-03T13:25:59.349Z', '2025-10-23T14:32:28.325Z', true, '{}'::jsonb),
  ('b80190d0-653a-46e3-962c-1abb0078b8c9', 'privacy-policy', true, 'Privacy Policy | {{store_name}}', 'Learn how {{store_name}} collects, uses, and protects your personal information. Read our privacy policy for details on data protection and your rights.', 'privacy policy, data protection, personal information, privacy rights, GDPR', 'index, follow', '{{STORE_ID}}', '[]'::jsonb, NULL, 9998, '2025-10-23T15:34:30.823Z', '2025-10-23T15:34:30.823Z', true, '{}'::jsonb)
ON CONFLICT DO NOTHING;


-- cms_page_translations (6 rows)
INSERT INTO "public"."cms_page_translations" ("cms_page_id", "language_code", "title", "content", "excerpt", "created_at", "updated_at") VALUES ('b80190d0-653a-46e3-962c-1abb0078b8c9', 'en', 'Privacy Policy', '<div style="max-width: 900px; margin: 0 auto; padding: 2rem; font-family: -apple-system, BlinkMacSystemFont, ''Segoe UI'', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;">
  <h1 style="font-size: 2.5rem; font-weight: bold; color: #111827; margin-bottom: 1.5rem; border-bottom: 3px solid #2563EB; padding-bottom: 0.5rem;">
    Privacy Policy
  </h1>

  <p style="color: #6B7280; margin-bottom: 2rem; font-size: 0.95rem;">
    <em>Last updated: 23/10/2025</em>
  </p>

  <div style="line-height: 1.8; color: #374151;">
    <section style="margin-bottom: 2rem;">
      <h2 style="font-size: 1.5rem; font-weight: 600; color: #111827; margin-bottom: 1rem;">Introduction</h2>
      <p style="margin-bottom: 1rem;">
        Welcome to {{store_name}}. We respect your privacy and are committed to protecting your personal data.
        This privacy policy will inform you about how we look after your personal data when you visit our website
        and tell you about your privacy rights and how the law protects you.
      </p>
    </section>

    <section style="margin-bottom: 2rem;">
      <h2 style="font-size: 1.5rem; font-weight: 600; color: #111827; margin-bottom: 1rem;">Information We Collect</h2>
      <p style="margin-bottom: 0.5rem;">We may collect, use, store and transfer different kinds of personal data about you:</p>
      <ul style="margin-left: 1.5rem; margin-bottom: 1rem;">
        <li style="margin-bottom: 0.5rem;"><strong>Identity Data:</strong> Name, username, or similar identifier</li>
        <li style="margin-bottom: 0.5rem;"><strong>Contact Data:</strong> Email address, telephone number, billing and delivery addresses</li>
        <li style="margin-bottom: 0.5rem;"><strong>Transaction Data:</strong> Details about payments and products you have purchased from us</li>
        <li style="margin-bottom: 0.5rem;"><strong>Technical Data:</strong> IP address, browser type, time zone setting, and location</li>
        <li style="margin-bottom: 0.5rem;"><strong>Usage Data:</strong> Information about how you use our website and services</li>
        <li style="margin-bottom: 0.5rem;"><strong>Marketing Data:</strong> Your preferences in receiving marketing from us</li>
      </ul>
    </section>

    <section style="margin-bottom: 2rem;">
      <h2 style="font-size: 1.5rem; font-weight: 600; color: #111827; margin-bottom: 1rem;">How We Use Your Information</h2>
      <p style="margin-bottom: 0.5rem;">We use your personal data for the following purposes:</p>
      <ul style="margin-left: 1.5rem; margin-bottom: 1rem;">
        <li style="margin-bottom: 0.5rem;">To process and deliver your orders</li>
        <li style="margin-bottom: 0.5rem;">To manage your account and provide customer support</li>
        <li style="margin-bottom: 0.5rem;">To improve our website, products, and services</li>
        <li style="margin-bottom: 0.5rem;">To send you marketing communications (with your consent)</li>
        <li style="margin-bottom: 0.5rem;">To comply with legal obligations</li>
      </ul>
    </section>

    <section style="margin-bottom: 2rem;">
      <h2 style="font-size: 1.5rem; font-weight: 600; color: #111827; margin-bottom: 1rem;">Cookies</h2>
      <p style="margin-bottom: 1rem;">
        We use cookies and similar tracking technologies to track activity on our website and store certain information.
        You can instruct your browser to refuse all cookies or to indicate when a cookie is being sent.
        However, if you do not accept cookies, you may not be able to use some portions of our website.
      </p>
      <p style="margin-bottom: 1rem;">
        For more information about the cookies we use, please see our Cookie Consent banner when you first visit our website.
      </p>
    </section>

    <section style="margin-bottom: 2rem;">
      <h2 style="font-size: 1.5rem; font-weight: 600; color: #111827; margin-bottom: 1rem;">Data Security</h2>
      <p style="margin-bottom: 1rem;">
        We have put in place appropriate security measures to prevent your personal data from being accidentally lost,
        used, or accessed in an unauthorized way. We limit access to your personal data to those employees, agents,
        contractors, and other third parties who have a business need to know.
      </p>
    </section>

    <section style="margin-bottom: 2rem;">
      <h2 style="font-size: 1.5rem; font-weight: 600; color: #111827; margin-bottom: 1rem;">Your Rights</h2>
      <p style="margin-bottom: 0.5rem;">Under data protection laws, you have rights including:</p>
      <ul style="margin-left: 1.5rem; margin-bottom: 1rem;">
        <li style="margin-bottom: 0.5rem;"><strong>Right to access:</strong> Request access to your personal data</li>
        <li style="margin-bottom: 0.5rem;"><strong>Right to rectification:</strong> Request correction of inaccurate data</li>
        <li style="margin-bottom: 0.5rem;"><strong>Right to erasure:</strong> Request deletion of your personal data</li>
        <li style="margin-bottom: 0.5rem;"><strong>Right to restrict processing:</strong> Request restriction on processing</li>
        <li style="margin-bottom: 0.5rem;"><strong>Right to data portability:</strong> Request transfer of your data</li>
        <li style="margin-bottom: 0.5rem;"><strong>Right to object:</strong> Object to processing of your personal data</li>
      </ul>
    </section>

    <section style="margin-bottom: 2rem;">
      <h2 style="font-size: 1.5rem; font-weight: 600; color: #111827; margin-bottom: 1rem;">Third-Party Links</h2>
      <p style="margin-bottom: 1rem;">
        Our website may include links to third-party websites, plug-ins, and applications. Clicking on those links
        may allow third parties to collect or share data about you. We do not control these third-party websites
        and are not responsible for their privacy statements.
      </p>
    </section>

    <section style="margin-bottom: 2rem;">
      <h2 style="font-size: 1.5rem; font-weight: 600; color: #111827; margin-bottom: 1rem;">Changes to This Privacy Policy</h2>
      <p style="margin-bottom: 1rem;">
        We may update our privacy policy from time to time. We will notify you of any changes by posting the new
        privacy policy on this page and updating the "Last updated" date at the top of this privacy policy.
      </p>
    </section>

    <section style="margin-bottom: 2rem;">
      <h2 style="font-size: 1.5rem; font-weight: 600; color: #111827; margin-bottom: 1rem;">Contact Us</h2>
      <p style="margin-bottom: 1rem;">
        If you have any questions about this privacy policy or our privacy practices, please contact us at:
      </p>
      <div style="background-color: #F3F4F6; padding: 1rem; border-radius: 8px; margin-top: 1rem;">
        <p style="margin: 0; color: #374151;">
          <strong>Email:</strong> <a href="mailto:{{store_email}}" style="color: #2563EB; text-decoration: none;">{{store_email}}</a>
        </p>
      </div>
    </section>
  </div>
</div>', null, '2025-10-24 16:42:18.032+00', '2025-10-26 01:20:11.289+00'), ('bbb26804-4ff2-4e8b-ba2b-e8c203704176', 'en', '404 - Page Not Found', '
<div style="text-align: center; padding: 2rem; max-width: 600px; margin: 0 auto;">
  <div style="font-size: 6rem; font-weight: bold; color: #9CA3AF; margin-bottom: 1rem;">404</div>

  <h1 style="font-size: 2rem; font-weight: bold; color: #111827; margin-bottom: 1rem;">
    Oops! Page Not Found
  </h1>

  <p style="color: #6B7280; margin-bottom: 2rem; font-size: 1.1rem; line-height: 1.6;">
    We''re sorry, but the page you''re looking for seems to have wandered off.
    Don''t worry though – we''ll help you find what you need!
  </p>

  <div style="margin-bottom: 2rem;">
    <p style="color: #374151; margin-bottom: 1rem;">Here are some helpful links:</p>
    <ul style="list-style: none; padding: 0; color: #2563EB;">
      <li style="margin-bottom: 0.5rem;">
        <a href="/" style="color: #2563EB; text-decoration: none;">🏠 Home Page</a>
      </li>
      <li style="margin-bottom: 0.5rem;">
        <a href="/category" style="color: #2563EB; text-decoration: none;">🛍️ Shop All Products</a>
      </li>
      <li style="margin-bottom: 0.5rem;">
        <a href="/contact" style="color: #2563EB; text-decoration: none;">📞 Contact Us</a>
      </li>
    </ul>
  </div>

  <div style="background-color: #F3F4F6; padding: 1.5rem; border-radius: 8px; margin-top: 2rem;">
    <p style="color: #374151; margin: 0; font-size: 0.9rem;">
      <strong>Need help?</strong> If you believe this is an error or you can''t find what you''re looking for,
      please don''t hesitate to contact our support team. We''re here to help!
    </p>
  </div>
</div>
', null, '2025-10-24 16:42:17.998+00', '2025-10-24 16:42:17.998+00');

-- cookie_consent_settings (1 rows)
-- Note: privacy_policy_url uses {{STORE_SLUG}} placeholder which is replaced during provisioning
-- Text fields (banner_text, accept_button_text, etc.) are now in cookie_consent_settings_translations table
INSERT INTO cookie_consent_settings (id, is_enabled, banner_position, privacy_policy_url, necessary_cookies, analytics_cookies, marketing_cookies, functional_cookies, theme, primary_color, background_color, text_color, gdpr_mode, auto_detect_country, audit_enabled, consent_expiry_days, show_close_button, categories, gdpr_countries, google_analytics_id, google_tag_manager_id, custom_css, store_id, created_at, updated_at, accept_button_bg_color, accept_button_text_color, reject_button_bg_color, reject_button_text_color, save_preferences_button_bg_color, save_preferences_button_text_color)
VALUES
  ('0f2cedc3-4af4-4a43-a4c6-3682faa95eab', true, 'bottom', '/public/{{STORE_SLUG}}/cms-page/privacy-policy', true, false, false, false, 'light', '#007bff', '#ffffff', '#333333', false, false, true, 365, true, '[{"id":"necessary","name":"Necessary Cookies","description":"These cookies are necessary for the website to function and cannot be switched off.","required":true,"default_enabled":true},{"id":"analytics","name":"Analytics Cookies","description":"These cookies help us understand how visitors interact with our website.","required":false,"default_enabled":false},{"id":"marketing","name":"Marketing Cookies","description":"These cookies are used to deliver personalized advertisements.","required":false,"default_enabled":false}]'::jsonb, '["AT","BE","BG","HR","CY","CZ","DK","EE","FI","FR","DE","GR","HU","IE","IT","LV","LT","LU","MT","NL","PL","PT","RO","SK","SI","ES","SE"]'::jsonb, NULL, NULL, '.cookie {}', '{{STORE_ID}}', '2025-10-17T18:19:57.435Z', '2025-10-26T01:33:47.627Z', '#00FF00', '#000', '#00FF00', '#000', '#ffff00', '#ffffff')
ON CONFLICT DO NOTHING;


-- cookie_consent_settings_translations (2 rows)
INSERT INTO cookie_consent_settings_translations (id, cookie_consent_settings_id, language_code, banner_text, accept_button_text, reject_button_text, settings_button_text, privacy_policy_text, created_at, updated_at, necessary_name, necessary_description, analytics_name, analytics_description, marketing_name, marketing_description, functional_name, functional_description, save_preferences_button_text)
VALUES
  ('e98e83e6-0c62-41b1-a207-6b9d556384d7', '0f2cedc3-4af4-4a43-a4c6-3682faa95eab', 'en', 'We use cookies to enhance your browsing experience, serve personalized content, and analyze our traffic. By clicking ''Accept All'', you consent to our use of cookies.', 'Accept All', 'Reject All', 'Cookie Settings', 'Privacy Policy', '2025-10-25T08:03:59.977Z', '2025-11-03T07:59:13.710Z', 'Necessary Cookies', 'These cookies are necessary for the website to function and cannot be switched off.', 'Analytics Cookies', 'These cookies help us understand how visitors interact with our website.', 'Marketing Cookies', 'These cookies are used to deliver personalized advertisements.', 'Functional Cookies', 'These cookies enable enhanced functionality and personalization.', 'Save now')
ON CONFLICT DO NOTHING;


-- email_templates (71 rows)
INSERT INTO email_templates ("id", "store_id", "identifier", "content_type", "variables", "is_active", "sort_order", "attachment_enabled", "attachment_config", "created_at", "updated_at", "is_system", "default_subject", "default_template_content", "default_html_content") VALUES ('caa52211-ddca-40d1-ac14-4b3d84ba256b', '{{STORE_ID}}', 'email_verification', 'html', '["customer_name", "customer_first_name", "verification_code", "store_name", "store_url", "current_year"]', 'true', '2', 'false', '{}', '2025-11-03 23:14:30.679+00', '2025-11-05 19:00:58.234+00', 'true', 'Verify your email - {{store_name}}', null, '{{email_header}}
<!-- Email Body -->
<table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #ffffff;">
  <tr>
    <td style="padding: 40px;">
      <p style="margin: 0 0 20px 0; color: #374151; font-size: 16px; line-height: 1.6;">
        Hi <strong>{{customer_first_name}}</strong>,
      </p>
      <p style="margin: 0 0 25px 0; color: #374151; font-size: 16px; line-height: 1.6;">
        Thank you for registering at {{store_name}}! Please use the following verification code to complete your registration:
      </p>
      <!-- Verification Code Box -->
      <table role="presentation" style="width: 100%; border-collapse: collapse; margin-bottom: 25px;">
        <tr>
          <td align="center">
            <table role="presentation" style="border-collapse: collapse; background-color: #f3f4f6; border-radius: 12px;">
              <tr>
                <td style="padding: 24px 48px;">
                  <p style="margin: 0 0 8px 0; color: #6b7280; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">
                    Your Verification Code
                  </p>
                  <p style="margin: 0; color: #111827; font-size: 36px; font-weight: 700; letter-spacing: 8px; font-family: monospace;">
                    {{verification_code}}
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
      <!-- Info Box -->
      <table role="presentation" style="width: 100%; border-collapse: collapse; margin-bottom: 25px;">
        <tr>
          <td style="padding: 16px; background-color: #eef2ff; border-left: 4px solid {{primary_color}}; border-radius: 0 8px 8px 0;">
            <p style="margin: 0; color: #3730a3; font-size: 14px; line-height: 1.5;">
              This code will expire in <strong>15 minutes</strong>. If you didn''t create an account, you can safely ignore this email.
            </p>
          </td>
        </tr>
      </table>
      <p style="margin: 0; color: #6b7280; font-size: 14px; text-align: center;">
        Enter this code on the verification page to continue.
      </p>
    </td>
  </tr>
</table>
{{email_footer}}'), ('c69316ab-7e8c-4590-850b-0f720c505d02', '{{STORE_ID}}', 'signup_email', 'both', '[{"key": "{{customer_name}}"}, {"key": "{{customer_first_name}}"}, {"key": "{{store_name}}"}, {"key": "{{store_url}}"}, {"key": "{{login_url}}"}, {"key": "{{current_year}}"}]', 'true', '1', 'false', '{}', '2025-10-31 21:21:14.762+00', '2025-11-05 19:00:58.234+00', 'true', 'Welcome to {{store_name}}!', 'Hi {{customer_first_name}},

Welcome to {{store_name}}! We''re excited to have you on board. Your account has been successfully created and verified.

What you can do now:
- Browse our products
- Track your orders
- Save addresses for faster checkout
- View your order history

Login to your account: {{login_url}}

Best regards,
The {{store_name}} Team', '{{email_header}}
<!-- Email Body -->
<table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #ffffff;">
  <tr>
    <td style="padding: 40px;">
      <p style="margin: 0 0 20px 0; color: #374151; font-size: 16px; line-height: 1.6;">
        Hi <strong>{{customer_first_name}}</strong>,
      </p>
      <p style="margin: 0 0 25px 0; color: #374151; font-size: 16px; line-height: 1.6;">
        Welcome to {{store_name}}! We''re excited to have you on board. Your account has been successfully created and verified.
      </p>
      <!-- Getting Started Card -->
      <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #f9fafb; border-radius: 8px; margin-bottom: 25px;">
        <tr>
          <td style="padding: 24px;">
            <h3 style="margin: 0 0 16px 0; color: #111827; font-size: 15px; font-weight: 600;">
              What you can do now:
            </h3>
            <table role="presentation" style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0; color: #374151; font-size: 14px;">• Browse our products</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #374151; font-size: 14px;">• Track your orders</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #374151; font-size: 14px;">• Save addresses for faster checkout</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #374151; font-size: 14px;">• View your order history</td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
      <!-- CTA Button -->
      <table role="presentation" style="width: 100%; border-collapse: collapse; margin-bottom: 25px;">
        <tr>
          <td align="center">
            <a href="{{login_url}}" style="display: inline-block; padding: 14px 32px; background-color: {{primary_color}}; color: #ffffff; text-decoration: none; font-weight: 600; font-size: 15px; border-radius: 6px;">
              Login to Your Account
            </a>
          </td>
        </tr>
      </table>
      <p style="margin: 0; color: #6b7280; font-size: 14px; text-align: center;">
        Need help? Our support team is always here for you.
      </p>
    </td>
  </tr>
</table>
{{email_footer}}'), ('d6696302-9e73-4b27-a4bf-b2832803b3e3', '{{STORE_ID}}', 'order_success_email', 'both', '["customer_name", "customer_first_name", "order_number", "order_date", "order_total", "order_subtotal", "order_tax", "order_shipping", "items_html", "items_count", "shipping_address", "billing_address", "store_name", "store_url", "current_year"]', 'true', '3', 'true', '{"generateInvoicePdf": true}', '2025-10-31 21:21:14.762+00', '2025-11-05 19:00:58.234+00', 'true', 'Order Confirmation #{{order_number}}', 'Hi {{customer_first_name}},

Thank you for your order!

Order Details:
- Order Number: {{order_number}}
- Order Date: {{order_date}}
- Total Amount: {{order_total}}
- Status: {{order_status}}

Items: {{items_count}} items
Shipping Address: {{shipping_address}}

Track your order: {{order_details_url}}

Best regards,
The {{store_name}} Team', '{{email_header}}
<!-- Title Section -->
<table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #ffffff;">
  <tr>
    <td style="padding: 0 20px 15px; text-align: center;">
      <h1 style="margin: 0 0 4px 0; color: #111827; font-size: 20px; font-weight: 600; line-height: 1.3;">
        Order Confirmed!
      </h1>
      <p style="margin: 0; color: #6b7280; font-size: 14px; font-weight: 400;">
        Order #{{order_number}}
      </p>
    </td>
  </tr>
</table>
<!-- Email Body -->
<table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #ffffff;">
  <tr>
    <td style="padding: 20px 40px 40px;">
      <p style="margin: 0 0 20px 0; color: #374151; font-size: 16px; line-height: 1.6;">
        Hi <strong>{{customer_first_name}}</strong>,
      </p>
      <p style="margin: 0 0 25px 0; color: #374151; font-size: 16px; line-height: 1.6;">
        Thank you for your order! Your order has been confirmed and is being processed.
      </p>
      <!-- Order Details Card -->
      <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #f9fafb; border-radius: 8px; margin-bottom: 20px;">
        <tr>
          <td style="padding: 20px;">
            <h3 style="margin: 0 0 16px 0; color: {{primary_color}}; font-size: 14px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">
              Order Details
            </h3>
            <table role="presentation" style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb; color: #6b7280; font-size: 14px;">Order Number</td>
                <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb; text-align: right; color: #111827; font-size: 14px; font-weight: 600;">{{order_number}}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Order Date</td>
                <td style="padding: 8px 0; text-align: right; color: #111827; font-size: 14px;">{{order_date}}</td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
      <!-- Order Items -->
      <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #f9fafb; border-radius: 8px; margin-bottom: 20px;">
        <tr>
          <td style="padding: 20px;">
            <h3 style="margin: 0 0 16px 0; color: {{primary_color}}; font-size: 14px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">
              Order Items
            </h3>
            {{items_html}}
          </td>
        </tr>
      </table>
      <!-- Order Summary -->
      <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #f9fafb; border-radius: 8px; margin-bottom: 25px;">
        <tr>
          <td style="padding: 20px;">
            <h3 style="margin: 0 0 16px 0; color: {{primary_color}}; font-size: 14px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">
              Order Summary
            </h3>
            <table role="presentation" style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb; color: #6b7280; font-size: 14px;">Subtotal</td>
                <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb; text-align: right; color: #111827; font-size: 14px;">{{order_subtotal}}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb; color: #6b7280; font-size: 14px;">Shipping</td>
                <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb; text-align: right; color: #111827; font-size: 14px;">{{order_shipping}}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb; color: #6b7280; font-size: 14px;">Tax</td>
                <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb; text-align: right; color: #111827; font-size: 14px;">{{order_tax}}</td>
              </tr>
              <tr>
                <td style="padding: 12px 0 0 0; font-size: 18px; font-weight: bold; color: {{primary_color}};">Total</td>
                <td style="padding: 12px 0 0 0; font-size: 18px; font-weight: bold; text-align: right; color: {{primary_color}};">{{order_total}}</td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
{{email_footer}}'), ('d3176294-44e3-4893-993d-9b5c60202aaa', '{{STORE_ID}}', 'invoice_email', 'html', '["invoice_number", "invoice_date", "order_number", "customer_name", "customer_first_name", "customer_email", "order_date", "order_total", "order_subtotal", "order_tax", "order_shipping", "items_html", "items_count", "billing_address", "shipping_address", "store_name", "store_url", "current_year", "email_header", "email_footer"]', 'true', '10', 'false', '{}', '2025-11-05 17:45:19.314+00', '2025-11-05 19:01:56.141+00', 'true', 'Invoice #{{invoice_number}} from {{store_name}}', null, '{{email_header}}
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <div style="background-color: #f8f9fa; padding: 30px;">
    <h2 style="color: {{primary_color}}; margin: 0 0 20px 0; text-align: center;">Invoice #{{invoice_number}}</h2>
    <p>Hi <strong>{{customer_first_name}}</strong>,</p>
    <p>Thank you for your order! Please find your invoice details below.</p>
    <div style="background-color: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
      <h3 style="margin-top: 0; color: {{primary_color}};">Invoice Details</h3>
      <table style="width: 100%; border-collapse: collapse;">
        <tr>
          <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb;">Invoice Number</td>
          <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb; text-align: right; font-weight: bold;">{{invoice_number}}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb;">Invoice Date</td>
          <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb; text-align: right;">{{invoice_date}}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0;">Order Number</td>
          <td style="padding: 8px 0; text-align: right;">{{order_number}}</td>
        </tr>
      </table>
    </div>
    <div style="background-color: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
      <h3 style="margin-top: 0; color: {{primary_color}};">Order Items</h3>
      {{items_html}}
    </div>
    <div style="background-color: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
      <h3 style="margin-top: 0; color: {{primary_color}};">Invoice Summary</h3>
      <table style="width: 100%; border-collapse: collapse;">
        <tr>
          <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb;">Subtotal</td>
          <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb; text-align: right;">{{order_subtotal}}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb;">Shipping</td>
          <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb; text-align: right;">{{order_shipping}}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb;">Tax</td>
          <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb; text-align: right;">{{order_tax}}</td>
        </tr>
        <tr>
          <td style="padding: 12px 0 0 0; font-size: 18px; font-weight: bold; color: {{primary_color}};">Total</td>
          <td style="padding: 12px 0 0 0; font-size: 18px; font-weight: bold; text-align: right; color: {{primary_color}};">{{order_total}}</td>
        </tr>
      </table>
    </div>
    <div style="background-color: white; padding: 15px; border-radius: 8px; border-left: 4px solid {{primary_color}}; margin: 20px 0;">
      <p style="margin: 0; color: #333;">
        <strong style="color: {{primary_color}};">Billing Address</strong><br>
        {{billing_address}}
      </p>
    </div>
    <div style="background-color: white; padding: 15px; border-radius: 8px; border-left: 4px solid #10b981; margin-bottom: 20px;">
      <p style="margin: 0; color: #333;">
        <strong style="color: #10b981;">Shipping Address</strong><br>
        {{shipping_address}}
      </p>
    </div>
  </div>
</div>
{{email_footer}}'), ('155851a2-e285-4ae8-a4eb-04b6aa024fad', '{{STORE_ID}}', 'shipment_email', 'html', '["order_number", "tracking_number", "tracking_url", "shipping_method", "estimated_delivery_date", "delivery_instructions", "customer_name", "customer_first_name", "customer_email", "items_html", "items_count", "shipping_address", "store_name", "store_url", "current_year", "email_header", "email_footer"]', 'true', '11', 'false', '{}', '2025-11-05 17:45:19.314+00', '2025-11-05 19:01:56.141+00', 'true', 'Your order #{{order_number}} has been shipped!', null, '{{email_header}}
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <div style="background-color: #f8f9fa; padding: 30px;">
    <h2 style="color: {{primary_color}}; margin: 0 0 20px 0; text-align: center;">Your Order is On Its Way!</h2>
    <p>Hi <strong>{{customer_first_name}}</strong>,</p>
    <p>Great news! Your order has been shipped and is on its way to you.</p>
    <div style="background-color: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
      <h3 style="margin-top: 0; color: {{primary_color}};">Shipping Details</h3>
      <table style="width: 100%; border-collapse: collapse;">
        <tr>
          <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb;">Order Number</td>
          <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb; text-align: right;">{{order_number}}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb;">Tracking Number</td>
          <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb; text-align: right; font-weight: bold;">{{tracking_number}}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb;">Shipping Method</td>
          <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb; text-align: right;">{{shipping_method}}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0;">Estimated Delivery</td>
          <td style="padding: 8px 0; text-align: right; font-weight: bold; color: #10b981;">{{estimated_delivery_date}}</td>
        </tr>
      </table>
    </div>
    <div style="text-align: center; margin: 30px 0;">
      <a href="{{tracking_url}}" style="background-color: {{primary_color}}; color: white; padding: 12px 32px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">
        Track Your Package
      </a>
    </div>
    <div style="background-color: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
      <h3 style="margin-top: 0; color: {{primary_color}};">Shipped Items</h3>
      {{items_html}}
    </div>
    <div style="background-color: white; padding: 15px; border-radius: 8px; border-left: 4px solid #10b981; margin: 20px 0;">
      <p style="margin: 0; color: #333;">
        <strong style="color: #10b981;">Shipping Address</strong><br>
        {{shipping_address}}
      </p>
    </div>
    <div style="background-color: white; padding: 15px; border-radius: 8px; border-left: 4px solid #f59e0b; margin-bottom: 20px;">
      <p style="margin: 0; color: #333;">
        <strong style="color: #f59e0b;">Delivery Instructions</strong><br>
        {{delivery_instructions}}
      </p>
    </div>
  </div>
</div>
{{email_footer}}'), ('07958749-5770-4838-87e1-b860ee355fb7', '{{STORE_ID}}', 'email_header', 'html', '["store_name", "store_logo_url", "primary_color"]', 'true', '100', 'false', '{}', '2025-11-05 17:45:19.314+00', '2025-11-05 19:01:56.141+00', 'true', 'Email Header Template', null, '<!-- Colorful Top Border - Gradient effect using segments -->
<table role="presentation" style="width: 100%; border-collapse: collapse; border-radius: 12px 12px 0 0; overflow: hidden;">
  <tr>
    <td style="height: 4px; width: 16.66%; background-color: {{primary_color}};"></td>
    <td style="height: 4px; width: 16.66%; background-color: {{secondary_color}};"></td>
    <td style="height: 4px; width: 16.66%; background-color: {{primary_color}};"></td>
    <td style="height: 4px; width: 16.66%; background-color: {{secondary_color}};"></td>
    <td style="height: 4px; width: 16.66%; background-color: {{primary_color}};"></td>
    <td style="height: 4px; width: 16.66%; background-color: {{secondary_color}};"></td>
  </tr>
</table>
<!-- Email Header - Clean white background -->
<table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #ffffff;">
  <tr>
    <td style="padding: 15px 5px 10px; text-align: center;">
      <img src="{{store_logo_url}}" alt="{{store_name}}" style="max-width: 60px; height: auto;" /><br/>
      <h1 style="font-size: 22px; font-weight: 700; color: #111827; letter-spacing: -0.5px; margin: 8px 0 0 0;">
        {{store_name}}
      </h1>
    </td>
  </tr>
</table>'), ('f67ae526-c1ab-45ab-bbd5-5b7b353644d9', '{{STORE_ID}}', 'email_footer', 'html', '["store_name", "store_url", "contact_email", "store_address", "store_city", "store_state", "store_postal_code", "current_year", "unsubscribe_url"]', 'true', '101', 'false', '{}', '2025-11-05 17:45:19.314+00', '2025-11-05 19:01:56.141+00', 'true', 'Email Footer Template', null, '<!-- Email Footer -->
<table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #ffffff; border-radius: 0 0 12px 12px;">
  <tr>
    <td style="padding: 24px 40px 32px; text-align: center;">
      <!-- Best regards -->
      <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 0 0 20px 0;">
      <p style="color: #6b7280; font-size: 13px; margin: 0 0 20px 0;">
        Best regards,<br>{{store_name}} Team<br>
        <a href="{{store_url}}" style="color: {{primary_color}};">{{store_url}}</a>
      </p>
      <!-- Contact -->
      <p style="margin: 0 0 12px 0; color: #6b7280; font-size: 13px;">
        Questions? <a href="mailto:{{contact_email}}" style="color: #6b7280; text-decoration: underline;">{{contact_email}}</a>
      </p>
      <!-- Address -->
      <p style="margin: 0 0 16px 0; color: #9ca3af; font-size: 11px;">
        {{store_address}}, {{store_city}}, {{store_state}} {{store_postal_code}}
      </p>
      <!-- Copyright -->
      <p style="margin: 0; color: #9ca3af; font-size: 11px;">
        © {{current_year}} {{store_name}}. All rights reserved.
      </p>
    </td>
  </tr>
</table>');

-- Stock issue email templates (3 rows)
INSERT INTO email_templates ("id", "store_id", "identifier", "content_type", "variables", "is_active", "sort_order", "attachment_enabled", "attachment_config", "created_at", "updated_at", "is_system", "default_subject", "default_template_content", "default_html_content") VALUES
('a1b2c3d4-e5f6-4789-abcd-111111111111', '{{STORE_ID}}', 'stock_issue_customer', 'both', '["customer_first_name", "order_number", "store_name", "store_url", "items_list"]', 'true', '25', 'false', '{}', '2025-11-26 10:00:00.000+00', '2025-11-26 10:00:00.000+00', 'true', 'Update on your order #{{order_number}} - {{store_name}}', 'Hi {{customer_first_name}},

Thank you for your order #{{order_number}} at {{store_name}}.

We wanted to let you know that we are currently reviewing your order. We may have detected a potential availability issue with one or more items in your order, and our team is working to resolve this as quickly as possible.

Items being reviewed:
{{items_list}}

We sincerely apologize for any inconvenience this may cause. We will contact you shortly with an update on your order status.

If you have any questions in the meantime, please don''t hesitate to reach out to us.

Best regards,
{{store_name}} Team', '{{email_header}}
<!-- Title Section -->
<table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #ffffff;">
  <tr>
    <td style="padding: 0 20px 15px; text-align: center;">
      <h1 style="margin: 0; color: #111827; font-size: 20px; font-weight: 600; line-height: 1.3;">
        Order Update
      </h1>
      <p style="margin: 4px 0 0 0; color: #6b7280; font-size: 14px;">
        Order #{{order_number}}
      </p>
    </td>
  </tr>
</table>
<!-- Email Body -->
<table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #ffffff;">
  <tr>
    <td style="padding: 20px 40px 40px;">
      <p style="margin: 0 0 20px 0; color: #374151; font-size: 16px; line-height: 1.6;">
        Hi <strong>{{customer_first_name}}</strong>,
      </p>
      <p style="margin: 0 0 20px 0; color: #374151; font-size: 16px; line-height: 1.6;">
        Thank you for your order <strong>#{{order_number}}</strong> at {{store_name}}.
      </p>
      <p style="margin: 0 0 25px 0; color: #374151; font-size: 16px; line-height: 1.6;">
        We wanted to let you know that we are currently reviewing your order. We may have detected a potential availability issue with one or more items, and our team is working to resolve this as quickly as possible.
      </p>
      <!-- Items Card -->
      <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #fef3c7; border-radius: 8px; margin-bottom: 25px; border-left: 4px solid #f59e0b;">
        <tr>
          <td style="padding: 20px;">
            <h3 style="margin: 0 0 12px 0; color: #92400e; font-size: 14px; font-weight: 600;">
              Items being reviewed:
            </h3>
            <pre style="margin: 0; white-space: pre-wrap; color: #92400e; font-family: inherit; font-size: 14px;">{{items_list}}</pre>
          </td>
        </tr>
      </table>
      <p style="margin: 0 0 20px 0; color: #374151; font-size: 16px; line-height: 1.6;">
        We sincerely apologize for any inconvenience this may cause. We will contact you shortly with an update on your order status.
      </p>
      <p style="margin: 0; color: #6b7280; font-size: 14px; line-height: 1.6;">
        If you have any questions in the meantime, please don''t hesitate to reach out to us.
      </p>
    </td>
  </tr>
</table>
{{email_footer}}'),
('a1b2c3d4-e5f6-4789-abcd-222222222222', '{{STORE_ID}}', 'stock_issue_admin', 'both', '["order_number", "order_id", "customer_email", "customer_name", "items_list", "store_name", "admin_url"]', 'true', '26', 'false', '{}', '2025-11-26 10:00:00.000+00', '2025-11-26 10:00:00.000+00', 'true', 'ACTION REQUIRED: Stock issue on order #{{order_number}}', 'Stock Issue Alert - Order #{{order_number}}

A stock issue has been detected for the following order:

Order Number: {{order_number}}
Customer: {{customer_name}}
Email: {{customer_email}}

Items with insufficient stock:
{{items_list}}

Please review this order and take appropriate action:
- Process a refund
- Wait for restock and contact customer
- Offer alternative products

View order in admin: {{admin_url}}

Best regards,
{{store_name}} System', '{{email_header}}
<!-- Title Section -->
<table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #ffffff;">
  <tr>
    <td style="padding: 0 20px 15px; text-align: center;">
      <h1 style="margin: 0; color: #dc2626; font-size: 20px; font-weight: 600; line-height: 1.3;">
        Stock Issue Alert
      </h1>
      <p style="margin: 4px 0 0 0; color: #6b7280; font-size: 14px;">
        Order #{{order_number}}
      </p>
    </td>
  </tr>
</table>
<!-- Email Body -->
<table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #ffffff;">
  <tr>
    <td style="padding: 20px 40px 40px;">
      <!-- Alert Card -->
      <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #fef2f2; border-radius: 8px; margin-bottom: 25px; border-left: 4px solid #dc2626;">
        <tr>
          <td style="padding: 20px;">
            <p style="margin: 0 0 8px 0; font-weight: 600; color: #991b1b; font-size: 15px;">Action Required</p>
            <p style="margin: 0; color: #991b1b; font-size: 14px;">A stock issue has been detected and requires your attention.</p>
          </td>
        </tr>
      </table>
      <!-- Order Details Card -->
      <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #f9fafb; border-radius: 8px; margin-bottom: 20px;">
        <tr>
          <td style="padding: 20px;">
            <h3 style="margin: 0 0 16px 0; color: {{primary_color}}; font-size: 14px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">
              Order Details
            </h3>
            <table role="presentation" style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb; color: #6b7280; font-size: 14px;">Order Number</td>
                <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb; text-align: right; color: #111827; font-size: 14px; font-weight: 600;">#{{order_number}}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb; color: #6b7280; font-size: 14px;">Customer</td>
                <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb; text-align: right; color: #111827; font-size: 14px;">{{customer_name}}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Email</td>
                <td style="padding: 8px 0; text-align: right; color: #111827; font-size: 14px;">{{customer_email}}</td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
      <!-- Items Card -->
      <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #fee2e2; border-radius: 8px; margin-bottom: 20px;">
        <tr>
          <td style="padding: 20px;">
            <h3 style="margin: 0 0 12px 0; color: #991b1b; font-size: 14px; font-weight: 600;">
              Items with Insufficient Stock
            </h3>
            <pre style="margin: 0; white-space: pre-wrap; color: #991b1b; font-family: inherit; font-size: 14px;">{{items_list}}</pre>
          </td>
        </tr>
      </table>
      <!-- Actions Card -->
      <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #f9fafb; border-radius: 8px; margin-bottom: 25px;">
        <tr>
          <td style="padding: 20px;">
            <h3 style="margin: 0 0 12px 0; color: #111827; font-size: 14px; font-weight: 600;">
              Recommended Actions
            </h3>
            <p style="margin: 0; color: #374151; font-size: 14px; line-height: 1.8;">
              • Process a full or partial refund<br>
              • Wait for restock and contact customer<br>
              • Offer alternative products
            </p>
          </td>
        </tr>
      </table>
      <!-- CTA Button -->
      <table role="presentation" style="width: 100%; border-collapse: collapse;">
        <tr>
          <td align="center">
            <a href="{{admin_url}}" style="display: inline-block; padding: 14px 32px; background-color: #dc2626; color: #ffffff; text-decoration: none; font-weight: 600; font-size: 15px; border-radius: 6px;">
              View Order in Admin
            </a>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
{{email_footer}}'),
('a1b2c3d4-e5f6-4789-abcd-333333333333', '{{STORE_ID}}', 'stock_issue_refunded', 'both', '["customer_first_name", "order_number", "store_name", "store_url", "refund_amount", "currency"]', 'true', '27', 'false', '{}', '2025-11-26 10:00:00.000+00', '2025-11-26 10:00:00.000+00', 'true', 'Your order #{{order_number}} has been refunded - {{store_name}}', 'Hi {{customer_first_name}},

We are writing to inform you that your order #{{order_number}} has been refunded.

Unfortunately, due to an inventory discrepancy, we were unable to fulfill your order. We sincerely apologize for any inconvenience this may have caused.

Refund Details:
- Order Number: #{{order_number}}
- Refund Amount: {{currency}} {{refund_amount}}

The refund has been processed and should appear in your account within 5-10 business days, depending on your payment provider.

We truly value you as a customer and hope you will give us another opportunity to serve you. Please feel free to browse our store for alternative products.

If you have any questions or concerns, please don''t hesitate to contact us.

Best regards,
{{store_name}} Team', '{{email_header}}
<!-- Title Section -->
<table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #ffffff;">
  <tr>
    <td style="padding: 0 20px 15px; text-align: center;">
      <h1 style="margin: 0; color: #111827; font-size: 20px; font-weight: 600; line-height: 1.3;">
        Order Refunded
      </h1>
    </td>
  </tr>
</table>
<!-- Email Body -->
<table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #ffffff;">
  <tr>
    <td style="padding: 20px 40px 40px;">
      <p style="margin: 0 0 20px 0; color: #374151; font-size: 16px; line-height: 1.6;">
        Hi <strong>{{customer_first_name}}</strong>,
      </p>
      <p style="margin: 0 0 20px 0; color: #374151; font-size: 16px; line-height: 1.6;">
        We are writing to inform you that your order <strong>#{{order_number}}</strong> has been refunded.
      </p>
      <p style="margin: 0 0 25px 0; color: #374151; font-size: 16px; line-height: 1.6;">
        Unfortunately, due to an inventory discrepancy, we were unable to fulfill your order. We sincerely apologize for any inconvenience this may have caused.
      </p>
      <!-- Refund Details Card -->
      <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #f9fafb; border-radius: 8px; margin-bottom: 25px;">
        <tr>
          <td style="padding: 20px;">
            <h3 style="margin: 0 0 16px 0; color: {{primary_color}}; font-size: 14px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">
              Refund Details
            </h3>
            <table role="presentation" style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb; color: #6b7280; font-size: 14px;">Order Number</td>
                <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb; text-align: right; color: #111827; font-size: 14px; font-weight: 600;">#{{order_number}}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Refund Amount</td>
                <td style="padding: 8px 0; text-align: right; color: #059669; font-size: 18px; font-weight: 600;">{{currency}} {{refund_amount}}</td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
      <p style="margin: 0 0 20px 0; color: #6b7280; font-size: 14px; line-height: 1.6;">
        The refund has been processed and should appear in your account within <strong>5-10 business days</strong>, depending on your payment provider.
      </p>
      <p style="margin: 0 0 25px 0; color: #374151; font-size: 16px; line-height: 1.6;">
        We truly value you as a customer and hope you will give us another opportunity to serve you.
      </p>
      <!-- CTA Button -->
      <table role="presentation" style="width: 100%; border-collapse: collapse;">
        <tr>
          <td align="center">
            <a href="{{store_url}}" style="display: inline-block; padding: 14px 32px; background-color: {{primary_color}}; color: #ffffff; text-decoration: none; font-weight: 600; font-size: 15px; border-radius: 6px;">
              Continue Shopping
            </a>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
{{email_footer}}'),
-- Password reset email template
('a1b2c3d4-e5f6-4789-abcd-444444444444', '{{STORE_ID}}', 'password_reset', 'both', '["customer_first_name", "customer_name", "reset_url", "reset_link", "store_name", "store_url", "current_year", "expiry_hours"]', 'true', '28', 'false', '{}', '2025-11-28 10:00:00.000+00', '2025-11-28 10:00:00.000+00', 'true', 'Reset your password - {{store_name}}', 'Hi {{customer_first_name}},

We received a request to reset your password for your {{store_name}} account.

Click the link below to set a new password:
{{reset_url}}

This link will expire in {{expiry_hours}} hour(s).

If you didn''t request a password reset, please ignore this email. Your password will remain unchanged.

Best regards,
{{store_name}} Team
{{store_url}}', '{{email_header}}
<!-- Title Section -->
<table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #ffffff;">
  <tr>
    <td style="padding: 0 20px 15px; text-align: center;">
      <h1 style="margin: 0; color: #111827; font-size: 20px; font-weight: 600; line-height: 1.3;">
        Reset Your Password
      </h1>
    </td>
  </tr>
</table>
<!-- Email Body -->
<table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #ffffff;">
  <tr>
    <td style="padding: 20px 40px 40px;">
      <p style="margin: 0 0 20px 0; color: #374151; font-size: 16px; line-height: 1.6;">
        Hi <strong>{{customer_first_name}}</strong>,
      </p>
      <p style="margin: 0 0 25px 0; color: #374151; font-size: 16px; line-height: 1.6;">
        We received a request to reset your password for your <strong>{{store_name}}</strong> account. Click the button below to set a new password:
      </p>
      <!-- CTA Button -->
      <table role="presentation" style="width: 100%; border-collapse: collapse; margin-bottom: 25px;">
        <tr>
          <td align="center">
            <a href="{{reset_url}}" style="display: inline-block; padding: 14px 32px; background-color: {{primary_color}}; color: #ffffff; text-decoration: none; font-weight: 600; font-size: 15px; border-radius: 6px;">
              Reset Password
            </a>
          </td>
        </tr>
      </table>
      <p style="margin: 0 0 12px 0; color: #6b7280; font-size: 14px;">Or copy and paste this link in your browser:</p>
      <p style="margin: 0 0 20px 0; word-break: break-all; background-color: #f3f4f6; padding: 12px; border-radius: 6px; font-size: 12px; color: #374151;">{{reset_url}}</p>
      <p style="margin: 0 0 25px 0; color: #6b7280; font-size: 14px;">This link will expire in <strong>{{expiry_hours}} hour(s)</strong>.</p>
      <!-- Warning Card -->
      <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #fef3c7; border-radius: 8px; border-left: 4px solid #f59e0b;">
        <tr>
          <td style="padding: 16px 20px;">
            <p style="margin: 0; color: #92400e; font-size: 14px;">If you didn''t request a password reset, please ignore this email. Your password will remain unchanged.</p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
{{email_footer}}'),
-- Password reset confirmation email template
('a1b2c3d4-e5f6-4789-abcd-555555555555', '{{STORE_ID}}', 'password_reset_confirmation', 'both', '["customer_first_name", "customer_name", "store_name", "store_url", "login_url", "current_year"]', 'true', '29', 'false', '{}', '2025-11-28 10:00:00.000+00', '2025-11-28 10:00:00.000+00', 'true', 'Your password has been reset - {{store_name}}', 'Hi {{customer_first_name}},

Your password for your {{store_name}} account has been successfully reset.

You can now log in with your new password:
{{login_url}}

If you did not make this change, please contact our support team immediately.

Best regards,
{{store_name}} Team
{{store_url}}', '{{email_header}}
<!-- Title Section -->
<table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #ffffff;">
  <tr>
    <td style="padding: 0 20px 15px; text-align: center;">
      <h1 style="margin: 0; color: #059669; font-size: 20px; font-weight: 600; line-height: 1.3;">
        Password Reset Successful
      </h1>
    </td>
  </tr>
</table>
<!-- Email Body -->
<table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #ffffff;">
  <tr>
    <td style="padding: 20px 40px 40px;">
      <p style="margin: 0 0 20px 0; color: #374151; font-size: 16px; line-height: 1.6;">
        Hi <strong>{{customer_first_name}}</strong>,
      </p>
      <p style="margin: 0 0 25px 0; color: #374151; font-size: 16px; line-height: 1.6;">
        Your password for your <strong>{{store_name}}</strong> account has been successfully reset.
      </p>
      <!-- CTA Button -->
      <table role="presentation" style="width: 100%; border-collapse: collapse; margin-bottom: 25px;">
        <tr>
          <td align="center">
            <a href="{{login_url}}" style="display: inline-block; padding: 14px 32px; background-color: {{primary_color}}; color: #ffffff; text-decoration: none; font-weight: 600; font-size: 15px; border-radius: 6px;">
              Log In Now
            </a>
          </td>
        </tr>
      </table>
      <!-- Security Warning Card -->
      <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #fef2f2; border-radius: 8px; border-left: 4px solid #dc2626;">
        <tr>
          <td style="padding: 16px 20px;">
            <p style="margin: 0; color: #991b1b; font-size: 14px;"><strong>Security Notice:</strong> If you did not make this change, please contact our support team immediately.</p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
{{email_footer}}');


-- email_template_translations (80 rows)
INSERT INTO "public"."email_template_translations" ("id", "email_template_id", "language_code", "subject", "template_content", "html_content", "created_at", "updated_at") VALUES ('b1c2d3e4-f5a6-4789-bcde-555555555555', 'a1b2c3d4-e5f6-4789-abcd-555555555555', 'en', 'Your password has been reset - {{store_name}}', 'Hi {{customer_first_name}},

Your password for your {{store_name}} account has been successfully reset.

You can now log in with your new password:
{{login_url}}

If you did not make this change, please contact our support team immediately.

Best regards,
{{store_name}} Team
{{store_url}}', '{{email_header}}
<!-- Title Section -->
<table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #ffffff;">
  <tr>
    <td style="padding: 0 20px 15px; text-align: center;">
      <h1 style="margin: 0; color: #059669; font-size: 20px; font-weight: 600; line-height: 1.3;">
        Password Reset Successful
      </h1>
    </td>
  </tr>
</table>
<!-- Email Body -->
<table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #ffffff;">
  <tr>
    <td style="padding: 20px 40px 40px;">
      <p style="margin: 0 0 20px 0; color: #374151; font-size: 16px; line-height: 1.6;">
        Hi <strong>{{customer_first_name}}</strong>,
      </p>
      <p style="margin: 0 0 25px 0; color: #374151; font-size: 16px; line-height: 1.6;">
        Your password for your <strong>{{store_name}}</strong> account has been successfully reset.
      </p>
      <!-- CTA Button -->
      <table role="presentation" style="width: 100%; border-collapse: collapse; margin-bottom: 25px;">
        <tr>
          <td align="center">
            <a href="{{login_url}}" style="display: inline-block; padding: 14px 32px; background-color: {{primary_color}}; color: #ffffff; text-decoration: none; font-weight: 600; font-size: 15px; border-radius: 6px;">
              Log In Now
            </a>
          </td>
        </tr>
      </table>
      <!-- Security Warning Card -->
      <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #fef2f2; border-radius: 8px; border-left: 4px solid #dc2626;">
        <tr>
          <td style="padding: 16px 20px;">
            <p style="margin: 0; color: #991b1b; font-size: 14px;"><strong>Security Notice:</strong> If you did not make this change, please contact our support team immediately.</p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
{{email_footer}}', '2025-11-28 10:00:00+00', '2025-11-28 10:00:00+00'), ('20229878-978d-4d65-84c7-5f4fa1b8357c', '155851a2-e285-4ae8-a4eb-04b6aa024fad', 'en', 'Your order #{{order_number}} has been shipped!', null, '{{email_header}}
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <div style="background-color: #f8f9fa; padding: 30px;">
    <h2 style="color: {{primary_color}}; margin: 0 0 20px 0; text-align: center;">Your Order is On Its Way!</h2>
    <p>Hi <strong>{{customer_first_name}}</strong>,</p>
    <p>Great news! Your order has been shipped and is on its way to you.</p>
    <div style="background-color: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
      <h3 style="margin-top: 0; color: {{primary_color}};">Shipping Details</h3>
      <table style="width: 100%; border-collapse: collapse;">
        <tr>
          <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb;">Order Number</td>
          <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb; text-align: right;">{{order_number}}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb;">Tracking Number</td>
          <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb; text-align: right; font-weight: bold;">{{tracking_number}}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb;">Shipping Method</td>
          <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb; text-align: right;">{{shipping_method}}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0;">Estimated Delivery</td>
          <td style="padding: 8px 0; text-align: right; font-weight: bold; color: #10b981;">{{estimated_delivery_date}}</td>
        </tr>
      </table>
    </div>
    <div style="text-align: center; margin: 30px 0;">
      <a href="{{tracking_url}}" style="background-color: {{primary_color}}; color: white; padding: 12px 32px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">
        Track Your Package
      </a>
    </div>
    <div style="background-color: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
      <h3 style="margin-top: 0; color: {{primary_color}};">Shipped Items</h3>
      {{items_html}}
    </div>
    <div style="background-color: white; padding: 15px; border-radius: 8px; border-left: 4px solid #10b981; margin: 20px 0;">
      <p style="margin: 0; color: #333;">
        <strong style="color: #10b981;">Shipping Address</strong><br>
        {{shipping_address}}
      </p>
    </div>
    <div style="background-color: white; padding: 15px; border-radius: 8px; border-left: 4px solid #f59e0b; margin-bottom: 20px;">
      <p style="margin: 0; color: #333;">
        <strong style="color: #f59e0b;">Delivery Instructions</strong><br>
        {{delivery_instructions}}
      </p>
    </div>
  </div>
</div>
{{email_footer}}', '2025-11-05 17:45:19.314+00', '2025-12-05 16:03:55.82265+00'), ('b1c2d3e4-f5a6-4789-bcde-333333333333', 'a1b2c3d4-e5f6-4789-abcd-333333333333', 'en', 'Your order #{{order_number}} has been refunded - {{store_name}}', 'Hi {{customer_first_name}},

We are writing to inform you that your order #{{order_number}} has been refunded.

Unfortunately, due to an inventory discrepancy, we were unable to fulfill your order. We sincerely apologize for any inconvenience this may have caused.

Refund Details:
- Order Number: #{{order_number}}
- Refund Amount: {{currency}} {{refund_amount}}

The refund has been processed and should appear in your account within 5-10 business days, depending on your payment provider.

We truly value you as a customer and hope you will give us another opportunity to serve you. Please feel free to browse our store for alternative products.

If you have any questions or concerns, please don''t hesitate to contact us.

Best regards,
{{store_name}} Team', '{{email_header}}
<!-- Title Section -->
<table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #ffffff;">
  <tr>
    <td style="padding: 0 20px 15px; text-align: center;">
      <h1 style="margin: 0; color: #111827; font-size: 20px; font-weight: 600; line-height: 1.3;">
        Order Refunded
      </h1>
    </td>
  </tr>
</table>
<!-- Email Body -->
<table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #ffffff;">
  <tr>
    <td style="padding: 20px 40px 40px;">
      <p style="margin: 0 0 20px 0; color: #374151; font-size: 16px; line-height: 1.6;">
        Hi <strong>{{customer_first_name}}</strong>,
      </p>
      <p style="margin: 0 0 20px 0; color: #374151; font-size: 16px; line-height: 1.6;">
        We are writing to inform you that your order <strong>#{{order_number}}</strong> has been refunded.
      </p>
      <p style="margin: 0 0 25px 0; color: #374151; font-size: 16px; line-height: 1.6;">
        Unfortunately, due to an inventory discrepancy, we were unable to fulfill your order. We sincerely apologize for any inconvenience this may have caused.
      </p>
      <!-- Refund Details Card -->
      <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #f9fafb; border-radius: 8px; margin-bottom: 25px;">
        <tr>
          <td style="padding: 20px;">
            <h3 style="margin: 0 0 16px 0; color: {{primary_color}}; font-size: 14px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">
              Refund Details
            </h3>
            <table role="presentation" style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb; color: #6b7280; font-size: 14px;">Order Number</td>
                <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb; text-align: right; color: #111827; font-size: 14px; font-weight: 600;">#{{order_number}}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Refund Amount</td>
                <td style="padding: 8px 0; text-align: right; color: #059669; font-size: 18px; font-weight: 600;">{{currency}} {{refund_amount}}</td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
      <p style="margin: 0 0 20px 0; color: #6b7280; font-size: 14px; line-height: 1.6;">
        The refund has been processed and should appear in your account within <strong>5-10 business days</strong>, depending on your payment provider.
      </p>
      <p style="margin: 0 0 25px 0; color: #374151; font-size: 16px; line-height: 1.6;">
        We truly value you as a customer and hope you will give us another opportunity to serve you.
      </p>
      <!-- CTA Button -->
      <table role="presentation" style="width: 100%; border-collapse: collapse;">
        <tr>
          <td align="center">
            <a href="{{store_url}}" style="display: inline-block; padding: 14px 32px; background-color: {{primary_color}}; color: #ffffff; text-decoration: none; font-weight: 600; font-size: 15px; border-radius: 6px;">
              Continue Shopping
            </a>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
{{email_footer}}', '2025-11-26 10:00:00+00', '2025-12-05 16:03:44.220462+00'), ('a1b52211-ddca-40d1-ac14-4b3d84ba256d', 'c69316ab-7e8c-4590-850b-0f720c505d02', 'en', 'Welcome to {{store_name}}!', 'Hi {{customer_first_name}},

Welcome to {{store_name}}! We are thrilled to have you with us.

Your account has been successfully created and verified. You can now:
- Browse our products
- Track your orders
- Save addresses for faster checkout
- View your order history

Login to your account: {{login_url}}

Best regards,
The {{store_name}} Team', '{{email_header}}
<!-- Email Body -->
<table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #ffffff;">
  <tr>
    <td style="padding: 40px;">
      <p style="margin: 0 0 20px 0; color: #374151; font-size: 16px; line-height: 1.6;">
        Hi <strong>{{customer_first_name}}</strong>,
      </p>
      <p style="margin: 0 0 25px 0; color: #374151; font-size: 16px; line-height: 1.6;">
        Welcome to {{store_name}}! We''re excited to have you on board. Your account has been successfully created and verified.
      </p>
      <!-- Getting Started Card -->
      <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #f9fafb; border-radius: 8px; margin-bottom: 25px;">
        <tr>
          <td style="padding: 24px;">
            <h3 style="margin: 0 0 16px 0; color: #111827; font-size: 15px; font-weight: 600;">
              What you can do now:
            </h3>
            <table role="presentation" style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0; color: #374151; font-size: 14px;">• Browse our products</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #374151; font-size: 14px;">• Track your orders</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #374151; font-size: 14px;">• Save addresses for faster checkout</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #374151; font-size: 14px;">• View your order history</td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
      <!-- CTA Button -->
      <table role="presentation" style="width: 100%; border-collapse: collapse; margin-bottom: 25px;">
        <tr>
          <td align="center">
            <a href="{{login_url}}" style="display: inline-block; padding: 14px 32px; background-color: {{primary_color}}; color: #ffffff; text-decoration: none; font-weight: 600; font-size: 15px; border-radius: 6px;">
              Login to Your Account
            </a>
          </td>
        </tr>
      </table>
      <p style="margin: 0; color: #6b7280; font-size: 14px; text-align: center;">
        Need help? Our support team is always here for you.
      </p>
    </td>
  </tr>
</table>
{{email_footer}}', '2025-11-26 10:00:00+00', '2025-11-26 10:00:00+00'), ('f8a52211-ddca-40d1-ac14-4b3d84ba256c', 'caa52211-ddca-40d1-ac14-4b3d84ba256b', 'en', 'Verify your email - {{store_name}}', 'Hi {{customer_first_name}},

Thank you for registering at {{store_name}}! Please use the following verification code to complete your registration:

Your verification code: {{verification_code}}

This code will expire in 15 minutes.

If you didn''t create an account at {{store_name}}, please ignore this email.

Best regards,
{{store_name}} Team', '{{email_header}}
<!-- Email Body -->
<table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #ffffff;">
  <tr>
    <td style="padding: 40px;">
      <p style="margin: 0 0 20px 0; color: #374151; font-size: 16px; line-height: 1.6;">
        Hi <strong>{{customer_first_name}}</strong>,
      </p>
      <p style="margin: 0 0 25px 0; color: #374151; font-size: 16px; line-height: 1.6;">
        Thank you for registering at {{store_name}}! Please use the following verification code to complete your registration:
      </p>
      <!-- Verification Code Box -->
      <table role="presentation" style="width: 100%; border-collapse: collapse; margin-bottom: 25px;">
        <tr>
          <td align="center">
            <table role="presentation" style="border-collapse: collapse; background-color: #f3f4f6; border-radius: 12px;">
              <tr>
                <td style="padding: 24px 48px;">
                  <p style="margin: 0 0 8px 0; color: #6b7280; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">
                    Your Verification Code
                  </p>
                  <p style="margin: 0; color: #111827; font-size: 36px; font-weight: 700; letter-spacing: 8px; font-family: monospace;">
                    {{verification_code}}
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
      <!-- Info Box -->
      <table role="presentation" style="width: 100%; border-collapse: collapse; margin-bottom: 25px;">
        <tr>
          <td style="padding: 16px; background-color: #eef2ff; border-left: 4px solid {{primary_color}}; border-radius: 0 8px 8px 0;">
            <p style="margin: 0; color: #3730a3; font-size: 14px; line-height: 1.5;">
              This code will expire in <strong>15 minutes</strong>. If you didn''t create an account, you can safely ignore this email.
            </p>
          </td>
        </tr>
      </table>
      <p style="margin: 0; color: #6b7280; font-size: 14px; text-align: center;">
        Enter this code on the verification page to continue.
      </p>
    </td>
  </tr>
</table>
{{email_footer}}', '2025-11-26 10:00:00+00', '2025-11-26 10:00:00+00'), ('b1c2d3e4-f5a6-4789-bcde-111111111111', 'a1b2c3d4-e5f6-4789-abcd-111111111111', 'en', 'Update on your order #{{order_number}} - {{store_name}}', 'Hi {{customer_first_name}},

Thank you for your order #{{order_number}} at {{store_name}}.

We wanted to let you know that we are currently reviewing your order. We may have detected a potential availability issue with one or more items in your order, and our team is working to resolve this as quickly as possible.

Items being reviewed:
{{items_list}}

We sincerely apologize for any inconvenience this may cause. We will contact you shortly with an update on your order status.

If you have any questions in the meantime, please don''t hesitate to reach out to us.

Best regards,
{{store_name}} Team', '{{email_header}}
<!-- Title Section -->
<table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #ffffff;">
  <tr>
    <td style="padding: 0 20px 15px; text-align: center;">
      <h1 style="margin: 0; color: #111827; font-size: 20px; font-weight: 600; line-height: 1.3;">
        Order Update
      </h1>
      <p style="margin: 4px 0 0 0; color: #6b7280; font-size: 14px;">
        Order #{{order_number}}
      </p>
    </td>
  </tr>
</table>
<!-- Email Body -->
<table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #ffffff;">
  <tr>
    <td style="padding: 20px 40px 40px;">
      <p style="margin: 0 0 20px 0; color: #374151; font-size: 16px; line-height: 1.6;">
        Hi <strong>{{customer_first_name}}</strong>,
      </p>
      <p style="margin: 0 0 20px 0; color: #374151; font-size: 16px; line-height: 1.6;">
        Thank you for your order <strong>#{{order_number}}</strong> at {{store_name}}.
      </p>
      <p style="margin: 0 0 25px 0; color: #374151; font-size: 16px; line-height: 1.6;">
        We wanted to let you know that we are currently reviewing your order. We may have detected a potential availability issue with one or more items, and our team is working to resolve this as quickly as possible.
      </p>
      <!-- Items Card -->
      <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #fef3c7; border-radius: 8px; margin-bottom: 25px; border-left: 4px solid #f59e0b;">
        <tr>
          <td style="padding: 20px;">
            <h3 style="margin: 0 0 12px 0; color: #92400e; font-size: 14px; font-weight: 600;">
              Items being reviewed:
            </h3>
            <pre style="margin: 0; white-space: pre-wrap; color: #92400e; font-family: inherit; font-size: 14px;">{{items_list}}</pre>
          </td>
        </tr>
      </table>
      <p style="margin: 0 0 20px 0; color: #374151; font-size: 16px; line-height: 1.6;">
        We sincerely apologize for any inconvenience this may cause. We will contact you shortly with an update on your order status.
      </p>
      <p style="margin: 0; color: #6b7280; font-size: 14px; line-height: 1.6;">
        If you have any questions in the meantime, please don''t hesitate to reach out to us.
      </p>
    </td>
  </tr>
</table>
{{email_footer}}', '2025-11-26 10:00:00+00', '2025-11-26 10:00:00+00'), ('b1c2d3e4-f5a6-4789-bcde-444444444444', 'a1b2c3d4-e5f6-4789-abcd-444444444444', 'en', 'Reset your password - {{store_name}}', 'Hi {{customer_first_name}},

We received a request to reset your password for your {{store_name}} account.

Click the link below to set a new password:
{{reset_url}}

This link will expire in {{expiry_hours}} hour(s).

If you didn''t request a password reset, please ignore this email. Your password will remain unchanged.

Best regards,
{{store_name}} Team
{{store_url}}', '{{email_header}}
<!-- Title Section -->
<table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #ffffff;">
  <tr>
    <td style="padding: 0 20px 15px; text-align: center;">
      <h1 style="margin: 0; color: #111827; font-size: 20px; font-weight: 600; line-height: 1.3;">
        Reset Your Password
      </h1>
    </td>
  </tr>
</table>
<!-- Email Body -->
<table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #ffffff;">
  <tr>
    <td style="padding: 20px 40px 40px;">
      <p style="margin: 0 0 20px 0; color: #374151; font-size: 16px; line-height: 1.6;">
        Hi <strong>{{customer_first_name}}</strong>,
      </p>
      <p style="margin: 0 0 25px 0; color: #374151; font-size: 16px; line-height: 1.6;">
        We received a request to reset your password for your <strong>{{store_name}}</strong> account. Click the button below to set a new password:
      </p>
      <!-- CTA Button -->
      <table role="presentation" style="width: 100%; border-collapse: collapse; margin-bottom: 25px;">
        <tr>
          <td align="center">
            <a href="{{reset_url}}" style="display: inline-block; padding: 14px 32px; background-color: {{primary_color}}; color: #ffffff; text-decoration: none; font-weight: 600; font-size: 15px; border-radius: 6px;">
              Reset Password
            </a>
          </td>
        </tr>
      </table>
      <p style="margin: 0 0 12px 0; color: #6b7280; font-size: 14px;">Or copy and paste this link in your browser:</p>
      <p style="margin: 0 0 20px 0; word-break: break-all; background-color: #f3f4f6; padding: 12px; border-radius: 6px; font-size: 12px; color: #374151;">{{reset_url}}</p>
      <p style="margin: 0 0 25px 0; color: #6b7280; font-size: 14px;">This link will expire in <strong>{{expiry_hours}} hour(s)</strong>.</p>
      <!-- Warning Card -->
      <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #fef3c7; border-radius: 8px; border-left: 4px solid #f59e0b;">
        <tr>
          <td style="padding: 16px 20px;">
            <p style="margin: 0; color: #92400e; font-size: 14px;">If you didn''t request a password reset, please ignore this email. Your password will remain unchanged.</p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
{{email_footer}}', '2025-11-28 10:00:00+00', '2025-11-28 10:00:00+00'), ('fdac4587-abf7-49d1-9e9d-ff8750bb6aa6', 'd6696302-9e73-4b27-a4bf-b2832803b3e3', 'en', 'Order Confirmation #{{order_number}}', 'Hi {{customer_first_name}},

Thank you for your order!

Order Details:
- Order Number: {{order_number}}
- Order Date: {{order_date}}
- Total Amount: {{order_total}}
- Status: {{order_status}}

Items: {{items_count}} items
Shipping Address: {{shipping_address}}

Track your order: {{order_details_url}}

Best regards,
The {{store_name}} Team', '{{email_header}}
<!-- Title Section -->
<table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #ffffff;">
  <tr>
    <td style="padding: 0 20px 15px; text-align: center;">
      <h1 style="margin: 0 0 4px 0; color: #111827; font-size: 20px; font-weight: 600; line-height: 1.3;">
        Order Confirmed!
      </h1>
      <p style="margin: 0; color: #6b7280; font-size: 14px; font-weight: 400;">
        Order #{{order_number}}
      </p>
    </td>
  </tr>
</table>
<!-- Email Body -->
<table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #ffffff;">
  <tr>
    <td style="padding: 20px 40px 40px;">
      <p style="margin: 0 0 20px 0; color: #374151; font-size: 16px; line-height: 1.6;">
        Hi <strong>{{customer_first_name}}</strong>,
      </p>
      <p style="margin: 0 0 25px 0; color: #374151; font-size: 16px; line-height: 1.6;">
        Thank you for your order! Your order has been confirmed and is being processed.
      </p>
      <!-- Order Details Card -->
      <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #f9fafb; border-radius: 8px; margin-bottom: 20px;">
        <tr>
          <td style="padding: 20px;">
            <h3 style="margin: 0 0 16px 0; color: {{primary_color}}; font-size: 14px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">
              Order Details
            </h3>
            <table role="presentation" style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb; color: #6b7280; font-size: 14px;">Order Number</td>
                <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb; text-align: right; color: #111827; font-size: 14px; font-weight: 600;">{{order_number}}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Order Date</td>
                <td style="padding: 8px 0; text-align: right; color: #111827; font-size: 14px;">{{order_date}}</td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
      <!-- Order Items -->
      <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #f9fafb; border-radius: 8px; margin-bottom: 20px;">
        <tr>
          <td style="padding: 20px;">
            <h3 style="margin: 0 0 16px 0; color: {{primary_color}}; font-size: 14px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">
              Order Items
            </h3>
            {{items_html}}
          </td>
        </tr>
      </table>
      <!-- Order Summary -->
      <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #f9fafb; border-radius: 8px; margin-bottom: 25px;">
        <tr>
          <td style="padding: 20px;">
            <h3 style="margin: 0 0 16px 0; color: {{primary_color}}; font-size: 14px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">
              Order Summary
            </h3>
            <table role="presentation" style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb; color: #6b7280; font-size: 14px;">Subtotal</td>
                <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb; text-align: right; color: #111827; font-size: 14px;">{{order_subtotal}}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb; color: #6b7280; font-size: 14px;">Shipping</td>
                <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb; text-align: right; color: #111827; font-size: 14px;">{{order_shipping}}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb; color: #6b7280; font-size: 14px;">Tax</td>
                <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb; text-align: right; color: #111827; font-size: 14px;">{{order_tax}}</td>
              </tr>
              <tr>
                <td style="padding: 12px 0 0 0; font-size: 18px; font-weight: bold; color: {{primary_color}};">Total</td>
                <td style="padding: 12px 0 0 0; font-size: 18px; font-weight: bold; text-align: right; color: {{primary_color}};">{{order_total}}</td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
{{email_footer}}', '2025-10-31 21:21:14.762+00', '2025-11-06 06:11:10.628+00'), ('ba6dbb5e-4bde-45ca-8386-d4940e8faaf5', 'd3176294-44e3-4893-993d-9b5c60202aaa', 'en', 'Invoice #{{invoice_number}} from {{store_name}}', null, '{{email_header}}
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <div style="background-color: #f8f9fa; padding: 30px;">
    <h2 style="color: {{primary_color}}; margin: 0 0 20px 0; text-align: center;">Invoice #{{invoice_number}}</h2>
    <p>Hi <strong>{{customer_first_name}}</strong>,</p>
    <p>Thank you for your order! Please find your invoice details below.</p>
    <div style="background-color: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
      <h3 style="margin-top: 0; color: {{primary_color}};">Invoice Details</h3>
      <table style="width: 100%; border-collapse: collapse;">
        <tr>
          <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb;">Invoice Number</td>
          <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb; text-align: right; font-weight: bold;">{{invoice_number}}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb;">Invoice Date</td>
          <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb; text-align: right;">{{invoice_date}}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0;">Order Number</td>
          <td style="padding: 8px 0; text-align: right;">{{order_number}}</td>
        </tr>
      </table>
    </div>
    <div style="background-color: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
      <h3 style="margin-top: 0; color: {{primary_color}};">Order Items</h3>
      {{items_html}}
    </div>
    <div style="background-color: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
      <h3 style="margin-top: 0; color: {{primary_color}};">Invoice Summary</h3>
      <table style="width: 100%; border-collapse: collapse;">
        <tr>
          <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb;">Subtotal</td>
          <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb; text-align: right;">{{order_subtotal}}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb;">Shipping</td>
          <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb; text-align: right;">{{order_shipping}}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb;">Tax</td>
          <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb; text-align: right;">{{order_tax}}</td>
        </tr>
        <tr>
          <td style="padding: 12px 0 0 0; font-size: 18px; font-weight: bold; color: {{primary_color}};">Total</td>
          <td style="padding: 12px 0 0 0; font-size: 18px; font-weight: bold; text-align: right; color: {{primary_color}};">{{order_total}}</td>
        </tr>
      </table>
    </div>
    <div style="background-color: white; padding: 15px; border-radius: 8px; border-left: 4px solid {{primary_color}}; margin: 20px 0;">
      <p style="margin: 0; color: #333;">
        <strong style="color: {{primary_color}};">Billing Address</strong><br>
        {{billing_address}}
      </p>
    </div>
    <div style="background-color: white; padding: 15px; border-radius: 8px; border-left: 4px solid #10b981; margin-bottom: 20px;">
      <p style="margin: 0; color: #333;">
        <strong style="color: #10b981;">Shipping Address</strong><br>
        {{shipping_address}}
      </p>
    </div>
  </div>
</div>
{{email_footer}}', '2025-11-05 17:45:19.314+00', '2025-12-05 15:13:06.768427+00'), ('00a2b31c-0f9e-4f6f-a0e1-211077b54eae', '07958749-5770-4838-87e1-b860ee355fb7', 'en', 'Email Header Template', null, '<!-- Colorful Top Border - Gradient effect using segments -->
<table role="presentation" style="width: 100%; border-collapse: collapse; border-radius: 12px 12px 0 0; overflow: hidden;">
  <tr>
    <td style="height: 4px; width: 16.66%; background-color: {{primary_color}};"></td>
    <td style="height: 4px; width: 16.66%; background-color: {{secondary_color}};"></td>
    <td style="height: 4px; width: 16.66%; background-color: {{primary_color}};"></td>
    <td style="height: 4px; width: 16.66%; background-color: {{secondary_color}};"></td>
    <td style="height: 4px; width: 16.66%; background-color: {{primary_color}};"></td>
    <td style="height: 4px; width: 16.66%; background-color: {{secondary_color}};"></td>
  </tr>
</table>
<!-- Email Header - Clean white background -->
<table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #ffffff;">
  <tr>
    <td style="padding: 15px 5px 10px; text-align: center;">
      <img src="{{store_logo_url}}" alt="{{store_name}}" style="max-width: 60px; height: auto;" /><br/>
      <h1 style="font-size: 22px; font-weight: 700; color: #111827; letter-spacing: -0.5px; margin: 8px 0 0 0;">
        {{store_name}}
      </h1>
    </td>
  </tr>
</table>', '2025-11-05 17:45:19.314+00', '2025-12-05 15:24:04.223845+00'), ('de637ddd-bcf9-4323-90fb-14b695d5cc81', 'f67ae526-c1ab-45ab-bbd5-5b7b353644d9', 'en', 'Email Footer Template', null, '<!-- Email Footer -->
<table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #ffffff; border-radius: 0 0 12px 12px;">
  <tr>
    <td style="padding: 24px 40px 32px; text-align: center;">
      <!-- Best regards -->
      <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 0 0 20px 0;">
      <p style="color: #6b7280; font-size: 13px; margin: 0 0 20px 0;">
        Best regards,<br>{{store_name}} Team<br>
        <a href="{{store_url}}" style="color: {{primary_color}};">{{store_url}}</a>
      </p>
      <!-- Contact -->
      <p style="margin: 0 0 12px 0; color: #6b7280; font-size: 13px;">
        Questions? <a href="mailto:{{contact_email}}" style="color: #6b7280; text-decoration: underline;">{{contact_email}}</a>
      </p>
      <!-- Address -->
      <p style="margin: 0 0 16px 0; color: #9ca3af; font-size: 11px;">
        {{store_address}}, {{store_city}}, {{store_state}} {{store_postal_code}}
      </p>
      <!-- Copyright -->
      <p style="margin: 0; color: #9ca3af; font-size: 11px;">
        © {{current_year}} {{store_name}}. All rights reserved.
      </p>
    </td>
  </tr>
</table>', '2025-11-05 17:45:19.314+00', '2025-12-05 15:59:13.967406+00'), ('b1c2d3e4-f5a6-4789-bcde-222222222222', 'a1b2c3d4-e5f6-4789-abcd-222222222222', 'en', 'ACTION REQUIRED: Stock issue on order #{{order_number}}', 'Stock Issue Alert - Order #{{order_number}}

A stock issue has been detected for the following order:

Order Number: {{order_number}}
Customer: {{customer_name}}
Email: {{customer_email}}

Items with insufficient stock:
{{items_list}}

Please review this order and take appropriate action:
- Process a refund
- Wait for restock and contact customer
- Offer alternative products

View order in admin: {{admin_url}}

Best regards,
{{store_name}} System', '{{email_header}}
<!-- Title Section -->
<table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #ffffff;">
  <tr>
    <td style="padding: 0 20px 15px; text-align: center;">
      <h1 style="margin: 0; color: #dc2626; font-size: 20px; font-weight: 600; line-height: 1.3;">
        Stock Issue Alert
      </h1>
      <p style="margin: 4px 0 0 0; color: #6b7280; font-size: 14px;">
        Order #{{order_number}}
      </p>
    </td>
  </tr>
</table>
<!-- Email Body -->
<table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #ffffff;">
  <tr>
    <td style="padding: 20px 40px 40px;">
      <!-- Alert Card -->
      <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #fef2f2; border-radius: 8px; margin-bottom: 25px; border-left: 4px solid #dc2626;">
        <tr>
          <td style="padding: 20px;">
            <p style="margin: 0 0 8px 0; font-weight: 600; color: #991b1b; font-size: 15px;">Action Required</p>
            <p style="margin: 0; color: #991b1b; font-size: 14px;">A stock issue has been detected and requires your attention.</p>
          </td>
        </tr>
      </table>
      <!-- Order Details Card -->
      <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #f9fafb; border-radius: 8px; margin-bottom: 20px;">
        <tr>
          <td style="padding: 20px;">
            <h3 style="margin: 0 0 16px 0; color: {{primary_color}}; font-size: 14px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">
              Order Details
            </h3>
            <table role="presentation" style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb; color: #6b7280; font-size: 14px;">Order Number</td>
                <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb; text-align: right; color: #111827; font-size: 14px; font-weight: 600;">#{{order_number}}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb; color: #6b7280; font-size: 14px;">Customer</td>
                <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb; text-align: right; color: #111827; font-size: 14px;">{{customer_name}}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Email</td>
                <td style="padding: 8px 0; text-align: right; color: #111827; font-size: 14px;">{{customer_email}}</td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
      <!-- Items Card -->
      <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #fee2e2; border-radius: 8px; margin-bottom: 20px;">
        <tr>
          <td style="padding: 20px;">
            <h3 style="margin: 0 0 12px 0; color: #991b1b; font-size: 14px; font-weight: 600;">
              Items with Insufficient Stock
            </h3>
            <pre style="margin: 0; white-space: pre-wrap; color: #991b1b; font-family: inherit; font-size: 14px;">{{items_list}}</pre>
          </td>
        </tr>
      </table>
      <!-- Actions Card -->
      <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #f9fafb; border-radius: 8px; margin-bottom: 25px;">
        <tr>
          <td style="padding: 20px;">
            <h3 style="margin: 0 0 12px 0; color: #111827; font-size: 14px; font-weight: 600;">
              Recommended Actions
            </h3>
            <p style="margin: 0; color: #374151; font-size: 14px; line-height: 1.8;">
              • Process a full or partial refund<br>
              • Wait for restock and contact customer<br>
              • Offer alternative products
            </p>
          </td>
        </tr>
      </table>
      <!-- CTA Button -->
      <table role="presentation" style="width: 100%; border-collapse: collapse;">
        <tr>
          <td align="center">
            <a href="{{admin_url}}" style="display: inline-block; padding: 14px 32px; background-color: #dc2626; color: #ffffff; text-decoration: none; font-weight: 600; font-size: 15px; border-radius: 6px;">
              View Order in Admin
            </a>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
{{email_footer}}', '2025-11-26 10:00:00+00', '2025-11-26 10:00:00+00')
ON CONFLICT DO NOTHING;

-- languages (15 rows)
INSERT INTO languages (id, code, name, native_name, flag, is_rtl, is_active, is_default, translations, created_at, updated_at)
VALUES
  ('3e123615-9e25-45cd-b783-6f180ca7033f', 'en', 'English', 'English', NULL, false, true, false, '{}'::jsonb, '2025-10-13T07:44:03.236Z', '2025-10-13T07:44:03.236Z'),
  ('e108298a-4581-4426-a499-bdba334f3f68', 'es', 'Spanish', 'Español', NULL, false, false, false, '{}'::jsonb, '2025-10-13T07:44:03.277Z', '2025-10-13T07:44:03.277Z'),
  ('a65c0a66-5588-4094-ad7e-edee09daa190', 'fr', 'French', 'Français', NULL, false, false, false, '{}'::jsonb, '2025-10-13T07:44:03.312Z', '2025-10-13T07:44:03.312Z'),
  ('79acd1f1-6df2-4f76-a5ae-7e12fc3eae21', 'de', 'German', 'Deutsch', NULL, false, false, false, '{}'::jsonb, '2025-10-13T07:44:03.346Z', '2025-10-13T07:44:03.346Z'),
  ('1132bd28-6dbb-4445-804e-f50d100069dd', 'it', 'Italian', 'Italiano', NULL, false, false, false, '{}'::jsonb, '2025-10-13T07:44:03.388Z', '2025-10-13T07:44:03.388Z'),
  ('362f8976-0827-454c-b687-b73c00f08b29', 'pt', 'Portuguese', 'Português', NULL, false, false, false, '{}'::jsonb, '2025-10-13T07:44:03.422Z', '2025-10-13T07:44:03.422Z'),
  ('04355f7b-f905-4bce-842f-1dcf6bfee7a5', 'nl', 'Dutch', 'Nederlands', NULL, false, true, false, '{}'::jsonb, '2025-10-13T07:44:03.456Z', '2025-10-13T07:44:03.456Z'),
  ('6756a8a6-e559-4166-a1af-eddca94e30a6', 'ar', 'Arabic', 'العربية', NULL, true, false, false, '{}'::jsonb, '2025-10-13T07:44:03.489Z', '2025-10-13T07:44:03.489Z'),
  ('a8421477-cb04-4536-8656-3643eef3508f', 'he', 'Hebrew', 'עברית', NULL, true, false, false, '{}'::jsonb, '2025-10-13T07:44:03.522Z', '2025-10-13T07:44:03.522Z'),
  ('2073e041-2174-4ea3-b57f-b922ceda7b47', 'zh', 'Chinese', '中文', NULL, false, false, false, '{}'::jsonb, '2025-10-13T07:44:03.559Z', '2025-10-13T07:44:03.559Z'),
  ('ca2daa51-05ee-49c9-90f6-c9f5bb34ded3', 'ja', 'Japanese', '日本語', NULL, false, false, false, '{}'::jsonb, '2025-10-13T07:44:03.600Z', '2025-10-13T07:44:03.600Z'),
  ('50aba09b-17a4-4976-861b-bad87f166bd8', 'ko', 'Korean', '한국어', NULL, false, false, false, '{}'::jsonb, '2025-10-13T07:44:03.637Z', '2025-10-13T07:44:03.637Z'),
  ('02af2fc8-cced-4d3d-8351-9d11f95df26a', 'ru', 'Russian', 'Русский', NULL, false, false, false, '{}'::jsonb, '2025-10-13T07:44:03.671Z', '2025-10-13T07:44:03.671Z'),
  ('e7020578-5969-49cf-b738-2024e9d7f1e9', 'pl', 'Polish', 'Polski', NULL, false, false, false, '{}'::jsonb, '2025-10-13T07:44:03.709Z', '2025-10-13T07:44:03.709Z'),
  ('141627ed-f0f0-4707-b54c-94f8f54bb421', 'tr', 'Turkish', 'Türkçe', NULL, false, false, false, '{}'::jsonb, '2025-10-13T07:44:03.743Z', '2025-10-13T07:44:03.743Z')
ON CONFLICT DO NOTHING;


-- payment_methods (3 rows)
INSERT INTO payment_methods (id, name, code, type, is_active, sort_order, description, settings, fee_type, fee_amount, min_amount, max_amount, availability, countries, store_id, created_at, updated_at, conditions, payment_flow)
VALUES
  ('ca67027c-e0a1-4cca-a836-0a3583179ee7', 'Cash on Delivery', 'CASH', 'cash_on_delivery', true, 0, '', '{}'::jsonb, 'none', '0.00', NULL, NULL, 'all', '[]'::jsonb, '{{STORE_ID}}', '2025-07-27T19:36:05.622Z', '2025-07-27T19:36:05.622Z', '{}'::jsonb, 'offline'),
  ('01b3d3ba-1b53-4115-8793-cca1372ef457', 'bank-en', 'bank_en', 'bank_transfer', true, 0, '', '{}'::jsonb, 'fixed', '8.00', NULL, NULL, 'all', '[]'::jsonb, '{{STORE_ID}}', '2025-07-27T19:36:32.972Z', '2025-10-26T12:32:00.638Z', '{"skus":[],"categories":["edbfff44-11d7-4b41-9232-008b4b3873a7"],"attribute_sets":["8a76e7ad-1b4d-4377-9b82-cac062bb5559"],"attribute_conditions":[]}'::jsonb, 'offline'),
  ('a01439da-bc46-4031-a303-14d60b046298', 'Creditcard', 'creditcard', 'credit_card', true, 0, '', '{}'::jsonb, 'percentage', '2.00', NULL, NULL, 'all', '[]'::jsonb, '{{STORE_ID}}', '2025-11-04T12:48:42.036Z', '2025-11-04T12:48:55.087Z', '{"skus":[],"categories":[],"attribute_sets":[],"attribute_conditions":[]}'::jsonb, 'online')
ON CONFLICT DO NOTHING;


-- payment_method_translations (3 rows)
INSERT INTO payment_method_translations (payment_method_id, language_code, name, description, created_at, updated_at)
VALUES
  ('ca67027c-e0a1-4cca-a836-0a3583179ee7', 'en', 'Cash on Delivery', '', '2025-10-24T16:42:27.922Z', '2025-10-24T16:42:27.922Z'),
  ('01b3d3ba-1b53-4115-8793-cca1372ef457', 'en', 'bank-en', '', '2025-10-24T16:42:27.972Z', '2025-10-24T16:42:27.972Z'),
  ('01b3d3ba-1b53-4115-8793-cca1372ef457', 'nl', 'bank-nl', '', '2025-10-24T16:42:28.016Z', '2025-10-24T16:42:28.016Z')
ON CONFLICT DO NOTHING;


-- pdf_templates (18 rows)
INSERT INTO "public"."pdf_templates" ("id", "store_id", "identifier", "name", "template_type", "default_html_template", "is_active", "is_system", "variables", "settings", "sort_order", "created_at", "updated_at") VALUES ('0e4dd1d6-5b96-48f6-8f5b-df3ad79a39c6', '{{STORE_ID}}', 'shipment_pdf', 'Shipment/Packing Slip PDF', 'shipment', '<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body {
      font-family: ''Helvetica'', ''Arial'', sans-serif;
      color: #333;
      line-height: 1.6;
      margin: 0;
      padding: 20px;
    }
    .container { max-width: 800px; margin: 0 auto; }
    table { width: 100%; border-collapse: collapse; }
    .header {
      text-align: center;
      padding: 20px;
      border-bottom: 3px solid #10b981;
      margin-bottom: 30px;
    }
    .tracking-section {
      background-color: #eff6ff;
      padding: 20px;
      border-radius: 8px;
      margin: 20px 0;
      text-align: center;
      border: 2px solid #3b82f6;
    }
    .info-section {
      background-color: #f0fdf4;
      padding: 20px;
      border-radius: 8px;
      margin: 20px 0;
      border-left: 4px solid #10b981;
    }
    .footer {
      margin-top: 50px;
      padding-top: 20px;
      border-top: 2px solid #e5e7eb;
      text-align: center;
      color: #9ca3af;
      font-size: 12px;
    }
  </style>
</head>
<body>
  <div class="container">
    <!-- Header -->
    <div class="header">
      {{#if store_logo_url}}
      <img src="{{store_logo_url}}" alt="{{store_name}}" style="max-width: 150px; max-height: 80px; margin-bottom: 10px;">
      {{/if}}
      <h1 style="color: #333; font-size: 28px; margin: 10px 0;">{{store_name}}</h1>
      <p style="color: #666; font-size: 14px; margin: 5px 0;">
        {{store_address}}<br>
        {{store_city}}, {{store_state}} {{store_postal_code}}<br>
        {{store_email}} | {{store_phone}}
      </p>
    </div>

    <!-- Shipment Notice -->
    <div style="text-align: right; margin-bottom: 30px;">
      <h2 style="color: #10b981; margin: 0;">SHIPMENT NOTICE</h2>
      <p style="font-size: 14px; color: #666; margin: 5px 0;">
        <strong>Order #:</strong> {{order_number}}<br>
        <strong>Ship Date:</strong> {{ship_date}}
      </p>
    </div>

    <!-- Tracking Info -->
    {{#if tracking_number}}
    <div class="tracking-section">
      <h3 style="color: #3b82f6; margin-top: 0;">Tracking Information</h3>
      <p style="font-size: 24px; font-weight: bold; margin: 15px 0; font-family: monospace; letter-spacing: 2px;">
        {{tracking_number}}
      </p>
      <p style="font-size: 14px; color: #666;">
        <strong>Shipping Method:</strong> {{shipping_method}}
      </p>
    </div>
    {{/if}}

    <!-- Shipping Address -->
    <div class="info-section">
      <h3 style="color: #10b981; margin-top: 0;">Shipping Address</h3>
      <p style="margin: 0; font-size: 16px;">{{shipping_address}}</p>
    </div>

    {{#if delivery_instructions}}
    <div style="padding: 15px; background-color: #fef3c7; border-radius: 8px; margin: 20px 0;">
      <h4 style="margin-top: 0; color: #92400e;">Delivery Instructions</h4>
      <p style="margin: 0;">{{delivery_instructions}}</p>
    </div>
    {{/if}}

    <!-- Package Contents -->
    <h3 style="margin-top: 30px;">Package Contents</h3>
    <table>
      <thead>
        <tr style="background-color: #f3f4f6;">
          <th style="padding: 12px; text-align: left; border-bottom: 2px solid #e5e7eb;">Item</th>
          <th style="padding: 12px; text-align: center; border-bottom: 2px solid #e5e7eb;">Qty</th>
          <th style="padding: 12px; text-align: left; border-bottom: 2px solid #e5e7eb;">SKU</th>
        </tr>
      </thead>
      <tbody>
        {{items_table_rows}}
      </tbody>
    </table>

    <div style="margin-top: 30px; padding: 20px; background-color: #f0fdf4; border-radius: 8px; text-align: center;">
      <p style="font-size: 16px; color: #065f46; margin: 0; font-weight: bold;">
        Total Items: {{items_count}}
      </p>
    </div>

    <!-- Footer -->
    <div class="footer">
      <p style="margin: 5px 0;">Thank you for your business!</p>
      <p style="margin: 5px 0;">{{store_name}} | {{store_website}}</p>
      <p style="margin: 5px 0;">© {{current_year}} {{store_name}}. All rights reserved.</p>
    </div>
  </div>
</body>
</html>', 'true', 'true', '["order_number", "ship_date", "tracking_number", "tracking_url", "shipping_method", "estimated_delivery_date", "delivery_instructions", "shipping_address", "items_table_rows", "items_count", "store_name", "store_logo_url", "store_address", "store_city", "store_state", "store_postal_code", "store_email", "store_phone", "store_website", "current_year"]', '{"margins": {"top": "20px", "left": "20px", "right": "20px", "bottom": "20px"}, "page_size": "A4", "orientation": "portrait"}', '2', '2025-11-05 18:05:27.493', '2025-11-05 18:05:27.493'), ('219b5514-0428-409a-83af-ba80dcd34983', '970bdec6-9eeb-4fbf-925f-cb0f36cc6094', 'invoice_pdf', 'Invoice PDF', 'invoice', '<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body {
      font-family: ''Helvetica'', ''Arial'', sans-serif;
      color: #333;
      line-height: 1.6;
      margin: 0;
      padding: 20px;
    }
    .container { max-width: 800px; margin: 0 auto; }
    table { width: 100%; border-collapse: collapse; }
    .info-section {
      background-color: #f9fafb;
      padding: 15px;
      border-radius: 8px;
      margin: 20px 0;
    }
    .total-section {
      background-color: #eff6ff;
      padding: 20px;
      border-radius: 8px;
      margin-top: 20px;
    }
    .header {
      text-align: center;
      padding: 20px;
      border-bottom: 3px solid #4f46e5;
      margin-bottom: 30px;
    }
    .footer {
      margin-top: 50px;
      padding-top: 20px;
      border-top: 2px solid #e5e7eb;
      text-align: center;
      color: #9ca3af;
      font-size: 12px;
    }
  </style>
</head>
<body>
  <div class="container">
    <!-- Header -->
    <div class="header">
      {{#if store_logo_url}}
      <img src="{{store_logo_url}}" alt="{{store_name}}" style="max-width: 150px; max-height: 80px; margin-bottom: 10px;">
      {{/if}}
      <h1 style="color: #333; font-size: 28px; margin: 10px 0;">{{store_name}}</h1>
      <p style="color: #666; font-size: 14px; margin: 5px 0;">
        {{store_address}}<br>
        {{store_city}}, {{store_state}} {{store_postal_code}}<br>
        {{store_email}} | {{store_phone}}
      </p>
    </div>

    <!-- Invoice Details -->
    <div style="text-align: right; margin-bottom: 30px;">
      <h2 style="color: #4f46e5; margin: 0;">INVOICE</h2>
      <p style="font-size: 14px; color: #666; margin: 5px 0;">
        <strong>Invoice #:</strong> {{invoice_number}}<br>
        <strong>Date:</strong> {{invoice_date}}<br>
        <strong>Order #:</strong> {{order_number}}
      </p>
    </div>

    <!-- Addresses -->
    <div style="display: flex; justify-content: space-between; margin-bottom: 30px;">
      <div style="width: 48%;" class="info-section">
        <h3 style="color: #4f46e5; margin-top: 0;">Bill To:</h3>
        <p style="margin: 0; font-size: 14px;">{{billing_address}}</p>
      </div>
      <div style="width: 48%;" class="info-section">
        <h3 style="color: #10b981; margin-top: 0;">Ship To:</h3>
        <p style="margin: 0; font-size: 14px;">{{shipping_address}}</p>
      </div>
    </div>

    <!-- Items Table -->
    <h3 style="color: #333; margin-bottom: 15px;">Order Items</h3>
    <table>
      <thead>
        <tr style="background-color: #f3f4f6;">
          <th style="padding: 12px; text-align: left; border-bottom: 2px solid #e5e7eb;">Item</th>
          <th style="padding: 12px; text-align: center; border-bottom: 2px solid #e5e7eb;">Qty</th>
          <th style="padding: 12px; text-align: right; border-bottom: 2px solid #e5e7eb;">Price</th>
          <th style="padding: 12px; text-align: right; border-bottom: 2px solid #e5e7eb;">Total</th>
        </tr>
      </thead>
      <tbody>
        {{items_table_rows}}
      </tbody>
    </table>

    <!-- Totals -->
    <div class="total-section">
      <table>
        <tr>
          <td style="padding: 5px 0;">Subtotal:</td>
          <td style="padding: 5px 0; text-align: right;">${{order_subtotal}}</td>
        </tr>
        <tr>
          <td style="padding: 5px 0;">Shipping:</td>
          <td style="padding: 5px 0; text-align: right;">${{order_shipping}}</td>
        </tr>
        <tr>
          <td style="padding: 5px 0;">Tax:</td>
          <td style="padding: 5px 0; text-align: right;">${{order_tax}}</td>
        </tr>
        {{#if order_discount}}
        <tr>
          <td style="padding: 5px 0; color: #10b981;">Discount:</td>
          <td style="padding: 5px 0; text-align: right; color: #10b981;">-${{order_discount}}</td>
        </tr>
        {{/if}}
        <tr style="border-top: 2px solid #4f46e5;">
          <td style="padding: 10px 0 0 0; font-size: 18px; font-weight: bold;">Total:</td>
          <td style="padding: 10px 0 0 0; text-align: right; font-size: 18px; font-weight: bold; color: #4f46e5;">${{order_total}}</td>
        </tr>
      </table>
    </div>

    {{#if payment_method}}
    <div style="margin-top: 20px; padding: 15px; background-color: #f0fdf4; border-left: 4px solid #10b981; border-radius: 4px;">
      <p style="margin: 0;">
        <strong>Payment Method:</strong> {{payment_method}}<br>
        <strong>Payment Status:</strong> {{payment_status}}
      </p>
    </div>
    {{/if}}

    <!-- Footer -->
    <div class="footer">
      <p style="margin: 5px 0;">Thank you for your business!</p>
      <p style="margin: 5px 0;">{{store_name}} | {{store_website}}</p>
      <p style="margin: 5px 0;">© {{current_year}} {{store_name}}. All rights reserved.</p>
    </div>
  </div>
</body>
</html>', 'true', 'true', '["invoice_number", "invoice_date", "order_number", "customer_name", "billing_address", "shipping_address", "items_table_rows", "order_subtotal", "order_shipping", "order_tax", "order_discount", "order_total", "payment_method", "payment_status", "store_name", "store_logo_url", "store_address", "store_city", "store_state", "store_postal_code", "store_email", "store_phone", "store_website", "current_year"]', '{"margins": {"top": "20px", "left": "20px", "right": "20px", "bottom": "20px"}, "page_size": "A4", "orientation": "portrait"}', '1', '2025-11-05 18:05:27.493', '2025-11-05 18:05:27.493');

-- pdf_template_translations (20 rows)
INSERT INTO "public"."pdf_template_translations" ("id", "pdf_template_id", "language_code", "html_template", "created_at", "updated_at") VALUES ('13bd2ee6-44c5-44b2-8ae5-866c52512f7f', '0e4dd1d6-5b96-48f6-8f5b-df3ad79a39c6', 'en', '<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body {
      font-family: ''Helvetica'', ''Arial'', sans-serif;
      color: #333;
      line-height: 1.6;
      margin: 0;
      padding: 20px;
    }
    .container { max-width: 800px; margin: 0 auto; }
    table { width: 100%; border-collapse: collapse; }
    .header {
      text-align: center;
      padding: 20px;
      border-bottom: 3px solid #10b981;
      margin-bottom: 30px;
    }
    .tracking-section {
      background-color: #eff6ff;
      padding: 20px;
      border-radius: 8px;
      margin: 20px 0;
      text-align: center;
      border: 2px solid #3b82f6;
    }
    .info-section {
      background-color: #f0fdf4;
      padding: 20px;
      border-radius: 8px;
      margin: 20px 0;
      border-left: 4px solid #10b981;
    }
    .footer {
      margin-top: 50px;
      padding-top: 20px;
      border-top: 2px solid #e5e7eb;
      text-align: center;
      color: #9ca3af;
      font-size: 12px;
    }
  </style>
</head>
<body>
  <div class="container">
    <!-- Header -->
    <div class="header">
      {{#if store_logo_url}}
      <img src="{{store_logo_url}}" alt="{{store_name}}" style="max-width: 150px; max-height: 80px; margin-bottom: 10px;">
      {{/if}}
      <h1 style="color: #333; font-size: 28px; margin: 10px 0;">{{store_name}}</h1>
      <p style="color: #666; font-size: 14px; margin: 5px 0;">
        {{store_address}}<br>
        {{store_city}}, {{store_state}} {{store_postal_code}}<br>
        {{store_email}} | {{store_phone}}
      </p>
    </div>

    <!-- Shipment Notice -->
    <div style="text-align: right; margin-bottom: 30px;">
      <h2 style="color: #10b981; margin: 0;">SHIPMENT NOTICE</h2>
      <p style="font-size: 14px; color: #666; margin: 5px 0;">
        <strong>Order #:</strong> {{order_number}}<br>
        <strong>Ship Date:</strong> {{ship_date}}
      </p>
    </div>

    <!-- Tracking Info -->
    {{#if tracking_number}}
    <div class="tracking-section">
      <h3 style="color: #3b82f6; margin-top: 0;">Tracking Information</h3>
      <p style="font-size: 24px; font-weight: bold; margin: 15px 0; font-family: monospace; letter-spacing: 2px;">
        {{tracking_number}}
      </p>
      <p style="font-size: 14px; color: #666;">
        <strong>Shipping Method:</strong> {{shipping_method}}
      </p>
    </div>
    {{/if}}

    <!-- Shipping Address -->
    <div class="info-section">
      <h3 style="color: #10b981; margin-top: 0;">Shipping Address</h3>
      <p style="margin: 0; font-size: 16px;">{{shipping_address}}</p>
    </div>

    {{#if delivery_instructions}}
    <div style="padding: 15px; background-color: #fef3c7; border-radius: 8px; margin: 20px 0;">
      <h4 style="margin-top: 0; color: #92400e;">Delivery Instructions</h4>
      <p style="margin: 0;">{{delivery_instructions}}</p>
    </div>
    {{/if}}

    <!-- Package Contents -->
    <h3 style="margin-top: 30px;">Package Contents</h3>
    <table>
      <thead>
        <tr style="background-color: #f3f4f6;">
          <th style="padding: 12px; text-align: left; border-bottom: 2px solid #e5e7eb;">Item</th>
          <th style="padding: 12px; text-align: center; border-bottom: 2px solid #e5e7eb;">Qty</th>
          <th style="padding: 12px; text-align: left; border-bottom: 2px solid #e5e7eb;">SKU</th>
        </tr>
      </thead>
      <tbody>
        {{items_table_rows}}
      </tbody>
    </table>

    <div style="margin-top: 30px; padding: 20px; background-color: #f0fdf4; border-radius: 8px; text-align: center;">
      <p style="font-size: 16px; color: #065f46; margin: 0; font-weight: bold;">
        Total Items: {{items_count}}
      </p>
    </div>

    <!-- Footer -->
    <div class="footer">
      <p style="margin: 5px 0;">Thank you for your business!</p>
      <p style="margin: 5px 0;">{{store_name}} | {{store_website}}</p>
      <p style="margin: 5px 0;">© {{current_year}} {{store_name}}. All rights reserved.</p>
    </div>
  </div>
</body>
</html>', '2025-11-05 18:05:27.493', '2025-11-06 05:11:10.75'), ('9f01e8b9-7f2c-4f7d-b1ae-80b19f4954cf', '219b5514-0428-409a-83af-ba80dcd34983', 'en', '<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body {
      font-family: ''Helvetica'', ''Arial'', sans-serif;
      color: #333;
      line-height: 1.6;
      margin: 0;
      padding: 20px;
    }
    .container { max-width: 800px; margin: 0 auto; }
    table { width: 100%; border-collapse: collapse; }
    .info-section {
      background-color: #f9fafb;
      padding: 15px;
      border-radius: 8px;
      margin: 20px 0;
    }
    .total-section {
      background-color: #eff6ff;
      padding: 20px;
      border-radius: 8px;
      margin-top: 20px;
    }
    .header {
      text-align: center;
      padding: 20px;
      border-bottom: 3px solid #4f46e5;
      margin-bottom: 30px;
    }
    .footer {
      margin-top: 50px;
      padding-top: 20px;
      border-top: 2px solid #e5e7eb;
      text-align: center;
      color: #9ca3af;
      font-size: 12px;
    }
  </style>
</head>
<body>
  <div class="container">
    <!-- Header -->
    <div class="header">
      {{#if store_logo_url}}
      <img src="{{store_logo_url}}" alt="{{store_name}}" style="max-width: 150px; max-height: 80px; margin-bottom: 10px;">
      {{/if}}
      <h1 style="color: #333; font-size: 28px; margin: 10px 0;">{{store_name}}</h1>
      <p style="color: #666; font-size: 14px; margin: 5px 0;">
        {{store_address}}<br>
        {{store_city}}, {{store_state}} {{store_postal_code}}<br>
        {{store_email}} | {{store_phone}}
      </p>
    </div>

    <!-- Invoice Details -->
    <div style="text-align: right; margin-bottom: 30px;">
      <h2 style="color: #4f46e5; margin: 0;">INVOICE</h2>
      <p style="font-size: 14px; color: #666; margin: 5px 0;">
        <strong>Invoice #:</strong> {{invoice_number}}<br>
        <strong>Date:</strong> {{invoice_date}}<br>
        <strong>Order #:</strong> {{order_number}}
      </p>
    </div>

    <!-- Addresses -->
    <div style="display: flex; justify-content: space-between; margin-bottom: 30px;">
      <div style="width: 48%;" class="info-section">
        <h3 style="color: #4f46e5; margin-top: 0;">Bill To:</h3>
        <p style="margin: 0; font-size: 14px;">{{billing_address}}</p>
      </div>
      <div style="width: 48%;" class="info-section">
        <h3 style="color: #10b981; margin-top: 0;">Ship To:</h3>
        <p style="margin: 0; font-size: 14px;">{{shipping_address}}</p>
      </div>
    </div>

    <!-- Items Table -->
    <h3 style="color: #333; margin-bottom: 15px;">Order Items</h3>
    <table>
      <thead>
        <tr style="background-color: #f3f4f6;">
          <th style="padding: 12px; text-align: left; border-bottom: 2px solid #e5e7eb;">Item</th>
          <th style="padding: 12px; text-align: center; border-bottom: 2px solid #e5e7eb;">Qty</th>
          <th style="padding: 12px; text-align: right; border-bottom: 2px solid #e5e7eb;">Price</th>
          <th style="padding: 12px; text-align: right; border-bottom: 2px solid #e5e7eb;">Total</th>
        </tr>
      </thead>
      <tbody>
        {{items_table_rows}}
      </tbody>
    </table>

    <!-- Totals -->
    <div class="total-section">
      <table>
        <tr>
          <td style="padding: 5px 0;">Subtotal:</td>
          <td style="padding: 5px 0; text-align: right;">${{order_subtotal}}</td>
        </tr>
        <tr>
          <td style="padding: 5px 0;">Shipping:</td>
          <td style="padding: 5px 0; text-align: right;">${{order_shipping}}</td>
        </tr>
        <tr>
          <td style="padding: 5px 0;">Tax:</td>
          <td style="padding: 5px 0; text-align: right;">${{order_tax}}</td>
        </tr>
        {{#if order_discount}}
        <tr>
          <td style="padding: 5px 0; color: #10b981;">Discount:</td>
          <td style="padding: 5px 0; text-align: right; color: #10b981;">-${{order_discount}}</td>
        </tr>
        {{/if}}
        <tr style="border-top: 2px solid #4f46e5;">
          <td style="padding: 10px 0 0 0; font-size: 18px; font-weight: bold;">Total:</td>
          <td style="padding: 10px 0 0 0; text-align: right; font-size: 18px; font-weight: bold; color: #4f46e5;">${{order_total}}</td>
        </tr>
      </table>
    </div>

    {{#if payment_method}}
    <div style="margin-top: 20px; padding: 15px; background-color: #f0fdf4; border-left: 4px solid #10b981; border-radius: 4px;">
      <p style="margin: 0;">
        <strong>Payment Method:</strong> {{payment_method}}<br>
        <strong>Payment Status:</strong> {{payment_status}}
      </p>
    </div>
    {{/if}}

    <!-- Footer -->
    <div class="footer">
      <p style="margin: 5px 0;">Thank you for your business!</p>
      <p style="margin: 5px 0;">{{store_name}} | {{store_website}}</p>
      <p style="margin: 5px 0;">© {{current_year}} {{store_name}}. All rights reserved.</p>
    </div>
  </div>
</body>
</html>', '2025-11-05 18:05:27.493', '2025-11-06 05:11:10.75');

-- shipping_methods (3 rows)
INSERT INTO shipping_methods (id, name, description, is_active, type, flat_rate_cost, free_shipping_min_order, weight_ranges, price_ranges, availability, countries, min_delivery_days, max_delivery_days, store_id, sort_order, created_at, updated_at, translations, conditions)
VALUES
  ('96ead2f0-d957-4c08-8685-4d0e41f4a4d4', 'Freeshipping', NULL, true, 'flat_rate', '0.00', '0.00', '[]'::jsonb, '[]'::jsonb, 'all', '[]'::jsonb, 1, 7, '{{STORE_ID}}', 0, '2025-07-27T17:37:18.979Z', '2025-10-23T05:01:37.173Z', '{"en":{"name":"Freeshipping","description":""}}'::jsonb, '{}'::jsonb),
  ('34dfa5d3-f709-4c54-bad8-0bd9a8ae3dc4', 'DHL', '', true, 'flat_rate', '7.00', '0.00', '[]'::jsonb, '[]'::jsonb, 'all', '[]'::jsonb, 1, 7, '{{STORE_ID}}', 0, '2025-07-27T17:36:59.081Z', '2025-10-25T21:31:17.657Z', '{"en":{"name":"DHL-en","description":"dddd"},"nl":{"name":"dhl-nl","description":""}}'::jsonb, '{"skus":[],"categories":["702e7f39-e6f0-43f3-9ed1-f704c2c656fb"],"attribute_sets":[],"attribute_conditions":[]}'::jsonb)
ON CONFLICT DO NOTHING;


-- shipping_method_translations (4 rows)
INSERT INTO shipping_method_translations (shipping_method_id, language_code, name, description, created_at, updated_at)
VALUES
  ('96ead2f0-d957-4c08-8685-4d0e41f4a4d4', 'en', 'Freeshipping', '', '2025-10-24T16:42:27.634Z', '2025-10-24T16:42:27.634Z'),
  ('34dfa5d3-f709-4c54-bad8-0bd9a8ae3dc4', 'en', 'DHL', '', '2025-10-24T16:42:27.715Z', '2025-10-25T23:31:17.657Z')
ON CONFLICT DO NOTHING;


-- translations (378 rows)
INSERT INTO translations (id, key, language_code, value, category, created_at, updated_at, type, store_id)
VALUES
  ('a12568dd-1415-4fe7-808e-a300640683c7', 'customer_auth.error.store_not_available', 'en', 'Store information not available. Please refresh the page.', 'customer_auth', '2025-11-12T19:47:07.088Z', '2025-11-12T19:47:07.088Z', 'system', '{{STORE_ID}}'),
  ('4a32cd06-679a-4ede-932a-5b77cf79f663', 'customer_auth.success.registration', 'en', 'Registration successful! A welcome email has been sent to your email address.', 'customer_auth', '2025-11-12T19:47:07.088Z', '2025-11-12T19:47:07.088Z', 'system', '{{STORE_ID}}'),
  ('95c37eae-d18d-495d-a841-1fd17a2d2ce7', 'customer_auth.error.registration_failed', 'en', 'Registration failed', 'customer_auth', '2025-11-12T19:47:07.088Z', '2025-11-12T19:47:07.088Z', 'system', '{{STORE_ID}}'),
  ('346d7c42-3b84-471a-b548-d96ffc91cc36', 'customer_auth.title', 'en', 'Customer Authentication', 'customer_auth', '2025-11-12T19:47:07.088Z', '2025-11-12T19:47:07.088Z', 'system', '{{STORE_ID}}'),
  ('e70a8d10-d8da-4460-8e4d-c8074b14dd84', 'customer_auth.error.config_not_available', 'en', 'Authentication configuration not available. Please contact support.', 'customer_auth', '2025-11-12T19:47:07.088Z', '2025-11-12T19:47:07.088Z', 'system', '{{STORE_ID}}'),
  ('4b0ed121-b5c2-4349-8df5-51ecacb9cd01', 'checkout.valid_email_required', 'en', 'Valid email required', 'checkout', '2025-11-07T18:34:17.198Z', '2025-11-12T22:28:53.341Z', 'system', '{{STORE_ID}}'),
  ('9b624c51-fe59-4c8d-a4c3-0029b05a950c', 'checkout.save_address_future', 'en', 'Save address for future use', 'checkout', '2025-11-07T18:34:17.198Z', '2025-11-12T22:28:53.341Z', 'system', '{{STORE_ID}}'),
  ('40fecf3a-57c2-4942-bf78-d6284a42272e', 'checkout.add_new_billing_address', 'en', 'Add New Billing Address', 'checkout', '2025-11-07T18:34:17.198Z', '2025-11-12T22:28:53.341Z', 'system', '{{STORE_ID}}'),
  ('3655533b-cf6f-4812-9801-9b1421d44d6e', 'checkout.save_billing_future', 'en', 'Save billing address for future use', 'checkout', '2025-11-07T18:34:17.198Z', '2025-11-12T22:28:53.341Z', 'system', '{{STORE_ID}}'),
  ('165e1db6-e6e9-4c4c-bd7b-d323e367b8e7', 'common.required', 'en', 'Required', 'common', '2025-11-07T18:34:17.198Z', '2025-11-12T19:51:37.265Z', 'custom', '{{STORE_ID}}'),
  ('2da458e1-2f84-4bf0-b6d1-7f03dce0e1e3', 'common.back', 'en', 'Back', 'common', '2025-11-07T18:34:17.198Z', '2025-11-12T19:51:37.265Z', 'system', '{{STORE_ID}}'),
  ('7c9fef91-9cff-464e-a436-7f113f5edd33', 'cookie_consent.title.preferences', 'en', 'Cookie Preferences', 'cookie_consent', '2025-11-12T19:51:37.265Z', '2025-11-12T21:04:57.850Z', 'system', '{{STORE_ID}}'),
  ('5fd9bd23-7c1e-411c-a938-1910f029573d', 'cookie_consent.title.manage_preferences', 'en', 'Manage Cookie Preferences', 'cookie_consent', '2025-11-12T19:51:37.265Z', '2025-11-12T21:04:57.850Z', 'system', '{{STORE_ID}}'),
  ('814bd5ec-2845-4915-ba6e-ad42e5baa63a', 'checkout.select_delivery_date', 'en', 'Select delivery date', 'checkout', '2025-11-07T18:34:17.198Z', '2025-11-12T22:28:53.341Z', 'system', '{{STORE_ID}}'),
  ('6bd148d4-2ede-4176-aab3-503bc9ab19ef', 'checkout.select_time_slot', 'en', 'Select time slot', 'checkout', '2025-11-07T18:34:17.198Z', '2025-11-12T22:28:53.341Z', 'system', '{{STORE_ID}}'),
  ('02c0ba86-c3bb-4578-b194-5bb623fc300a', 'checkout.special_delivery_instructions', 'en', 'Special Delivery Instructions', 'checkout', '2025-11-07T18:34:17.198Z', '2025-11-12T22:28:53.341Z', 'system', '{{STORE_ID}}'),
  ('58caa1f3-c9af-4bb0-be4e-6dfaa08d456f', 'auth.success.account_upgraded', 'en', 'Account upgraded successfully', 'auth', '2025-11-12T19:02:35.990Z', '2025-11-12T20:08:48.241Z', 'system', '{{STORE_ID}}'),
  ('cd1b089a-7bd8-40f3-920f-e4d24f3ba5d1', 'auth.success.login', 'en', 'Login successful', 'auth', '2025-11-12T19:02:35.990Z', '2025-11-12T20:08:48.241Z', 'system', '{{STORE_ID}}'),
  ('4dbb8ce2-1fc5-4e83-afc1-b2915f3dd28f', 'auth.success.logout', 'en', 'Logged out successfully', 'auth', '2025-11-12T19:02:35.990Z', '2025-11-12T20:08:48.241Z', 'system', '{{STORE_ID}}'),
  ('2466761d-039f-4ff0-a734-7a3b876e89f7', 'auth.success.registration', 'en', 'Registration successful! Please check your email for a verification code.', 'auth', '2025-11-12T19:02:35.990Z', '2025-11-12T20:08:48.241Z', 'system', '{{STORE_ID}}'),
  ('a21b6288-e8eb-4dae-816b-37ec474e58ac', 'auth.success.email_verified', 'en', 'Email verified successfully!', 'auth', '2025-11-12T19:02:35.990Z', '2025-11-12T20:08:48.241Z', 'system', '{{STORE_ID}}'),
  ('51d93783-702a-4a52-9ccd-ed9d57954422', 'auth.success.verification_sent', 'en', 'Verification code sent! Please check your email.', 'auth', '2025-11-12T19:02:35.990Z', '2025-11-12T20:08:48.241Z', 'system', '{{STORE_ID}}'),
  ('164b73a9-9269-4a54-9af0-ddf084370240', 'auth.error.server', 'en', 'Server error', 'auth', '2025-11-12T19:02:35.990Z', '2025-11-12T20:08:48.241Z', 'system', '{{STORE_ID}}'),
  ('c8bdc23f-03e6-4adc-a128-4be6da1ff277', 'auth.error.user_exists', 'en', 'User with this email already exists in the {tableName} table', 'auth', '2025-11-12T19:02:35.990Z', '2025-11-12T20:08:48.241Z', 'system', '{{STORE_ID}}'),
  ('1d66644a-cf2f-4cc8-b5a9-1e63cdd73069', 'checkout.login_for_faster_checkout', 'en', 'Already have an account? Login for faster checkout', 'checkout', '2025-11-12T18:32:09.157Z', '2025-11-12T18:32:09.157Z', 'system', '{{STORE_ID}}'),
  ('5da0a9fa-d622-47af-aa08-e015d02581c3', 'checkout.special_instructions_placeholder', 'en', 'Enter any special instructions', 'checkout', '2025-11-07T18:34:17.198Z', '2025-11-12T22:28:53.341Z', 'system', '{{STORE_ID}}'),
  ('b427de52-6824-4352-bf1f-a5cf42ebf889', 'checkout.fee', 'en', 'Fee', 'checkout', '2025-11-07T18:34:17.198Z', '2025-11-12T22:28:53.341Z', 'system', '{{STORE_ID}}'),
  ('f2bfc695-b37d-46d5-97d7-53a38509cd1a', 'auth.error.password.uppercase', 'en', 'Password must contain at least one uppercase letter', 'auth', '2025-11-12T19:02:35.990Z', '2025-11-12T20:08:48.241Z', 'system', '{{STORE_ID}}'),
  ('172772c6-4980-43c1-8f94-00eecb99def1', 'auth.error.password.lowercase', 'en', 'Password must contain at least one lowercase letter', 'auth', '2025-11-12T19:02:35.990Z', '2025-11-12T20:08:48.241Z', 'system', '{{STORE_ID}}'),
  ('3f930084-5bc5-47df-8e77-2f43fd600ed7', 'auth.error.password.number', 'en', 'Password must contain at least one number', 'auth', '2025-11-12T19:02:35.990Z', '2025-11-12T20:08:48.241Z', 'system', '{{STORE_ID}}'),
  ('121ee497-409f-40c8-9f6e-2a678b0a59d8', 'auth.error.password.special_char', 'en', 'Password must contain at least one special character', 'auth', '2025-11-12T19:02:35.990Z', '2025-11-12T20:08:48.241Z', 'system', '{{STORE_ID}}'),
  ('43db44aa-e7ea-4907-aae5-d68255688589', 'auth.error.email.invalid', 'en', 'Please enter a valid email', 'auth', '2025-11-12T19:02:35.990Z', '2025-11-12T20:08:48.241Z', 'system', '{{STORE_ID}}'),
  ('d6bb0436-c207-4e2c-926f-fa622da7f7d2', 'auth.error.first_name.required', 'en', 'First name is required', 'auth', '2025-11-12T19:02:35.990Z', '2025-11-12T20:08:48.241Z', 'system', '{{STORE_ID}}'),
  ('1c1ff39b-0815-4f94-8d5b-126b58df2302', 'auth.error.last_name.required', 'en', 'Last name is required', 'auth', '2025-11-12T19:02:35.990Z', '2025-11-12T20:08:48.241Z', 'system', '{{STORE_ID}}'),
  ('424bb061-2eaf-4252-b67e-a47424ef38db', 'auth.error.password.required', 'en', 'Password is required', 'auth', '2025-11-12T19:02:35.990Z', '2025-11-12T20:08:48.241Z', 'system', '{{STORE_ID}}'),
  ('d338ad3f-06b9-4ecf-b8fd-d0ce1c2ffb52', 'auth.error.role.invalid', 'en', 'Invalid role', 'auth', '2025-11-12T19:02:35.990Z', '2025-11-12T20:08:48.241Z', 'system', '{{STORE_ID}}'),
  ('107e3de8-7fb8-4d0c-875e-647331b19527', 'auth.error.store_id.required', 'en', 'Store ID is required', 'auth', '2025-11-12T19:02:35.990Z', '2025-11-12T20:08:48.241Z', 'system', '{{STORE_ID}}'),
  ('7e1bcf53-07ab-4fc3-a02d-87c8a49bf2d8', 'auth.error.verification_code.required', 'en', 'Verification code is required', 'auth', '2025-11-12T19:02:35.990Z', '2025-11-12T20:08:48.241Z', 'system', '{{STORE_ID}}'),
  ('7248ae73-99df-45a4-b4e1-f7180240b24d', 'checkout.qty', 'en', 'Qty', 'checkout', '2025-11-07T18:34:17.198Z', '2025-11-12T22:28:53.341Z', 'system', '{{STORE_ID}}'),
  ('e77cb1a7-8895-464a-97ec-6860c6b7926a', 'auth.error.password.min_length', 'en', 'Password must be at least 8 characters long', 'auth', '2025-11-12T19:02:35.990Z', '2025-11-12T22:48:47.036Z', 'system', '{{STORE_ID}}'),
  ('f8b3deb6-d9fc-4a25-978d-1d1437e13fa9', 'auth.error.guest_not_found', 'en', 'No guest account found with this email, or account is already registered', 'auth', '2025-11-12T19:02:35.990Z', '2025-11-12T20:08:48.241Z', 'system', '{{STORE_ID}}'),
  ('1d880540-c7dc-4369-8dd5-e4a811ff4727', 'auth.error.account_inactive', 'en', 'Account is inactive', 'auth', '2025-11-12T19:02:35.990Z', '2025-11-12T20:08:48.241Z', 'system', '{{STORE_ID}}'),
  ('a4e23d0c-edbc-4d62-ab61-4ea07c3be31a', 'auth.error.rate_limit', 'en', 'Too many login attempts. Please try again later.', 'auth', '2025-11-12T19:02:35.990Z', '2025-11-12T20:08:48.241Z', 'system', '{{STORE_ID}}'),
  ('03fd55e4-6a38-43cf-add0-3b22828d6989', 'auth.error.invalid_credentials', 'en', 'Invalid credentials', 'auth', '2025-11-12T19:02:35.990Z', '2025-11-12T20:08:48.241Z', 'system', '{{STORE_ID}}'),
  ('363ec630-09fe-4932-8a63-c3d1c64834fa', 'auth.error.logout_failed', 'en', 'Logout failed', 'auth', '2025-11-12T19:02:35.990Z', '2025-11-12T20:08:48.241Z', 'system', '{{STORE_ID}}'),
  ('c6b44275-db05-43fa-ac02-fc72fb4f8236', 'auth.error.customer_exists', 'en', 'Customer with this email already exists', 'auth', '2025-11-12T19:02:35.990Z', '2025-11-12T20:08:48.241Z', 'system', '{{STORE_ID}}'),
  ('05aeb1c4-d6e9-49ee-b2a6-f19a38eb02e1', 'auth.error.customer_exists_alt', 'en', 'A customer with this email already exists', 'auth', '2025-11-12T19:02:35.990Z', '2025-11-12T20:08:48.241Z', 'system', '{{STORE_ID}}'),
  ('7b7fbb00-23a0-4c6b-a9ce-a10478953a0d', 'auth.error.registration_failed', 'en', 'Server error during registration. Please try again.', 'auth', '2025-11-12T19:02:35.990Z', '2025-11-12T20:08:48.241Z', 'system', '{{STORE_ID}}'),
  ('1d8db3e3-c2ce-4424-9523-e5d263e4ab2b', 'auth.error.account_not_activated', 'en', 'This account has not been activated yet. Please create a password first.', 'auth', '2025-11-12T19:02:35.990Z', '2025-11-12T20:08:48.241Z', 'system', '{{STORE_ID}}'),
  ('c06887fd-6703-4322-8f93-764f9b0eccfa', 'auth.error.verification_failed', 'en', 'Server error during verification', 'auth', '2025-11-12T19:02:35.990Z', '2025-11-12T20:08:48.241Z', 'system', '{{STORE_ID}}'),
  ('717ce7a7-7b0e-49be-aaa3-9d80541ac551', 'checkout.login_to_continue', 'en', 'Login to your account for faster checkout', 'checkout', '2025-11-12T19:00:37.916Z', '2025-11-12T19:00:37.916Z', 'system', '{{STORE_ID}}'),
  ('7328c89c-8e12-4413-a421-041a6849f435', 'auth.error.no_store_assigned', 'en', 'Customer account is not assigned to a store. Please contact support.', 'auth', '2025-11-12T19:02:35.990Z', '2025-11-12T20:08:48.241Z', 'system', '{{STORE_ID}}'),
  ('4b010cba-88c3-48bc-9fb0-0ec335280d90', 'auth.error.customer_not_found', 'en', 'Customer not found', 'auth', '2025-11-12T19:02:35.990Z', '2025-11-12T20:08:48.241Z', 'system', '{{STORE_ID}}'),
  ('14993a2b-41b8-4947-bb5b-9269be98f583', 'auth.error.email_already_verified', 'en', 'Email is already verified', 'auth', '2025-11-12T19:02:35.990Z', '2025-11-12T20:08:48.241Z', 'system', '{{STORE_ID}}'),
  ('7a609dda-bfa1-4902-b0e3-8385972061e5', 'auth.error.verification_code_invalid', 'en', 'Invalid verification code', 'auth', '2025-11-12T19:02:35.990Z', '2025-11-12T20:08:48.241Z', 'system', '{{STORE_ID}}'),
  ('232a5617-2f9b-451a-bf3e-cae26994101d', 'auth.error.verification_code_expired', 'en', 'Verification code has expired. Please request a new one.', 'auth', '2025-11-12T19:02:35.990Z', '2025-11-12T20:08:48.241Z', 'system', '{{STORE_ID}}'),
  ('bfd65484-82d8-41f9-b51c-57884d352388', 'checkout.guest_checkout', 'en', 'Guest Checkout', 'checkout', '2025-11-12T18:59:00.784Z', '2025-11-12T22:28:53.341Z', 'system', '{{STORE_ID}}'),
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'checkout.login_required', 'en', 'Login Required', 'checkout', '2025-11-28T12:00:00.000Z', '2025-11-28T12:00:00.000Z', 'system', '{{STORE_ID}}'),
  ('b2c3d4e5-f6a7-8901-bcde-f12345678901', 'checkout.login_required_description', 'en', 'Please login or create an account to complete your purchase', 'checkout', '2025-11-28T12:00:00.000Z', '2025-11-28T12:00:00.000Z', 'system', '{{STORE_ID}}'),
  ('c3d4e5f6-a7b8-9012-cdef-123456789012', 'checkout.login_to_checkout', 'en', 'Login to Checkout', 'checkout', '2025-11-28T12:00:00.000Z', '2025-11-28T12:00:00.000Z', 'system', '{{STORE_ID}}'),
  ('e139c66d-787f-4a22-ae1c-626607b8ae47', 'auth.error.oauth_failed', 'en', 'Google authentication failed. Please try again.', 'auth', '2025-11-12T21:59:25.474Z', '2025-11-12T21:59:25.474Z', 'system', '{{STORE_ID}}'),
  ('0f283b60-73b1-427b-a190-2ffdcd613cec', 'auth.error.token_generation_failed', 'en', 'Failed to generate authentication token. Please try again.', 'auth', '2025-11-12T21:59:25.474Z', '2025-11-12T21:59:25.474Z', 'system', '{{STORE_ID}}'),
  ('57aee28f-4491-4fda-aeee-2bb941adb739', 'auth.error.database_connection_failed', 'en', 'Database connection issue. Please try again in a few moments.', 'auth', '2025-11-12T21:59:25.474Z', '2025-11-12T21:59:25.474Z', 'system', '{{STORE_ID}}'),
  ('6152f569-01da-4afd-9cd3-6b1b16474085', 'auth.error.general', 'en', 'An error occurred. Please try again.', 'auth', '2025-11-12T21:59:25.474Z', '2025-11-12T21:59:25.474Z', 'system', '{{STORE_ID}}'),
  ('25d89325-b5e6-48cf-86c1-5cd7c3d99f3b', 'auth.error.google_not_available_customer', 'en', 'Google authentication is not available for customers.', 'auth', '2025-11-12T21:59:25.474Z', '2025-11-12T21:59:25.474Z', 'system', '{{STORE_ID}}'),
  ('121a46fc-8a6e-4950-99c7-5df7c8c42280', 'auth.error.google_redirect_failed', 'en', 'Google authentication redirect failed. The service may not be configured properly.', 'auth', '2025-11-12T21:59:25.474Z', '2025-11-12T21:59:25.474Z', 'system', '{{STORE_ID}}'),
  ('ab2713fd-30ac-4a47-863f-f094a75dfc8f', 'auth.error.redirect_failed', 'en', 'Failed to redirect to Google authentication.', 'auth', '2025-11-12T21:59:25.474Z', '2025-11-12T21:59:25.474Z', 'system', '{{STORE_ID}}'),
  ('4996026c-4431-4a09-8575-5b9bbaae39e6', 'common.store_info_not_available', 'en', 'Store information not available. Please refresh.', 'common', '2025-11-07T18:34:17.198Z', '2025-11-12T22:28:53.341Z', 'system', '{{STORE_ID}}'),
  ('7cb36c3a-2d74-4a63-b15e-e6f06d0ccaf9', 'common.login_failed', 'en', 'Login failed. Please check your credentials.', 'common', '2025-11-07T18:34:17.198Z', '2025-11-12T22:28:53.341Z', 'system', '{{STORE_ID}}'),
  ('da8ecbc1-1025-42b6-9d20-d8954cb02595', 'common.coupon_expired', 'en', 'This coupon has expired', 'common', '2025-11-07T18:34:17.198Z', '2025-11-12T22:28:53.341Z', 'system', '{{STORE_ID}}'),
  ('9c813da0-3ccb-4f43-945a-c989689a7a63', 'common.coupon_usage_limit', 'en', 'This coupon has reached its usage limit', 'common', '2025-11-07T18:34:17.198Z', '2025-11-12T22:28:53.341Z', 'system', '{{STORE_ID}}'),
  ('8cfb6bf0-d1cc-4eb4-afd8-190d21e5b4d7', 'common.minimum_order_required', 'en', 'Minimum order amount of {amount} required', 'common', '2025-11-07T18:34:17.198Z', '2025-11-12T22:28:53.341Z', 'system', '{{STORE_ID}}'),
  ('16912f6c-ca7a-4d1f-9d05-2dcc28f3ceb2', 'common.invalid_coupon', 'en', 'Invalid or expired coupon code', 'common', '2025-11-07T18:34:17.198Z', '2025-11-12T22:28:53.341Z', 'system', '{{STORE_ID}}'),
  ('fd1dd53c-9bfe-4159-a7fd-9f9c6cedf0a7', 'common.email', 'en', 'Email', 'common', '2025-11-07T18:34:17.198Z', '2025-11-12T22:28:53.341Z', 'system', '{{STORE_ID}}'),
  ('10fe9a9d-5c79-40ea-bff7-714d0d51f7af', 'common.full_name', 'en', 'Full Name', 'common', '2025-11-07T18:34:17.198Z', '2025-11-12T22:28:53.341Z', 'system', '{{STORE_ID}}'),
  ('913ceccd-c5ba-4f4f-8a76-1203c98d5fd5', 'common.street_address', 'en', 'Street Address', 'common', '2025-11-07T18:34:17.198Z', '2025-11-12T22:28:53.341Z', 'system', '{{STORE_ID}}'),
  ('b62cc28e-68e3-4542-ac6e-952ad668faf9', 'auth.success.user_created', 'en', 'User created successfully', 'auth', '2025-11-12T19:02:35.990Z', '2025-11-12T20:08:48.241Z', 'system', '{{STORE_ID}}'),
  ('9f86b7ef-3312-4e19-a6a8-aa28b540e82a', 'common.previous', 'en', 'Previous', 'common', '2025-11-07T18:34:17.198Z', '2025-11-07T18:34:17.198Z', 'system', '{{STORE_ID}}'),
  ('62ebdb59-e740-420f-bee5-20903e117e16', 'common.city', 'en', 'City', 'common', '2025-11-07T18:34:17.198Z', '2025-11-12T22:28:53.341Z', 'system', '{{STORE_ID}}'),
  ('df4b934d-dc5e-481a-8af3-b9485da679ab', 'common.state_province', 'en', 'State / Province', 'common', '2025-11-07T18:34:17.198Z', '2025-11-12T22:28:53.341Z', 'system', '{{STORE_ID}}'),
  ('e9375adf-456a-4ac8-a1e8-1ab0b4d9ee08', 'common.postal_code', 'en', 'Postal Code', 'common', '2025-11-07T18:34:17.198Z', '2025-11-12T22:28:53.341Z', 'system', '{{STORE_ID}}'),
  ('f616060f-6c92-4102-b1af-1af10eb0b348', 'checkout.add_new_shipping_address', 'en', 'Add New Shipping Address', 'checkout', '2025-11-07T18:34:17.198Z', '2025-11-12T22:28:53.341Z', 'system', '{{STORE_ID}}'),
  ('5395b855-c5b2-4c78-9b0a-31c964562f60', 'checkout.no_saved_addresses', 'en', 'No saved addresses', 'checkout', '2025-11-07T18:34:17.198Z', '2025-11-12T22:28:53.341Z', 'system', '{{STORE_ID}}'),
  ('53f2c6d2-30ca-43a9-bca8-e05c7b330f08', 'common.search', 'en', 'Search', 'common', '2025-11-07T18:34:17.198Z', '2025-11-07T18:34:17.198Z', 'system', '{{STORE_ID}}'),
  ('28f31ff2-9267-49f8-b449-267b28711d7c', 'common.filter', 'en', 'Filter', 'common', '2025-11-07T18:34:17.198Z', '2025-11-07T18:34:17.198Z', 'system', '{{STORE_ID}}'),
  ('81128793-901f-4fde-a8be-a527f0950928', 'common.sort', 'en', 'Sort', 'common', '2025-11-07T18:34:17.198Z', '2025-11-07T18:34:17.198Z', 'system', '{{STORE_ID}}'),
  ('fff4429e-1b25-48ce-b4b3-be7620f3f922', 'common.loading', 'en', 'Loading...', 'common', '2025-11-07T18:34:17.198Z', '2025-11-07T18:34:17.198Z', 'system', '{{STORE_ID}}'),
  ('e66fc361-a29b-4189-9bf7-ccb0b1af2c51', 'common.no', 'en', 'No', 'common', '2025-11-07T18:34:17.198Z', '2025-11-07T18:34:17.198Z', 'system', '{{STORE_ID}}'),
  ('60387ed0-90da-479a-ac03-f8ef55a1f666', 'common.confirm', 'en', 'Confirm', 'common', '2025-11-07T18:34:17.198Z', '2025-11-07T18:34:17.198Z', 'system', '{{STORE_ID}}'),
  ('5f4f3b38-992c-477a-acd3-0b730276057b', 'common.view', 'en', 'View', 'common', '2025-11-07T18:34:17.198Z', '2025-11-07T18:34:17.198Z', 'system', '{{STORE_ID}}'),
  ('b1a523d3-cc74-4991-8258-8bccc5937a56', 'common.all', 'en', 'All', 'common', '2025-11-07T18:34:17.198Z', '2025-11-07T18:34:17.198Z', 'system', '{{STORE_ID}}'),
  ('85f25b56-d786-41ba-80a9-5207e7ca3ad8', 'product.stock', 'en', 'Stock', 'product', '2025-11-07T18:34:17.198Z', '2025-11-07T18:34:17.198Z', 'system', '{{STORE_ID}}'),
  ('b491edbd-145f-4d19-9ead-749361e983b3', 'product.description', 'en', 'Description', 'product', '2025-11-07T18:34:17.198Z', '2025-11-07T18:34:17.198Z', 'system', '{{STORE_ID}}'),
  ('a7690b80-1163-4472-bf45-7a20ec7289ca', 'product.images', 'en', 'Images', 'product', '2025-11-07T18:34:17.198Z', '2025-11-07T18:34:17.198Z', 'system', '{{STORE_ID}}'),
  ('14829cec-f2f4-40db-9294-17edaa3d24ed', 'product.category', 'en', 'Category', 'product', '2025-11-07T18:34:17.198Z', '2025-11-07T18:34:17.198Z', 'system', '{{STORE_ID}}'),
  ('1805534c-2a5b-4a2d-b831-cc6b70c32130', 'product.related', 'en', 'Related Products', 'product', '2025-11-07T18:34:17.198Z', '2025-11-07T18:34:17.198Z', 'system', '{{STORE_ID}}'),
  ('087aa0f7-f153-464b-af69-ef6e5cd27142', 'checkout.payment', 'en', 'Payment', 'checkout', '2025-11-07T18:34:17.198Z', '2025-11-07T18:34:17.198Z', 'system', '{{STORE_ID}}'),
  ('dc29b259-8d7b-4c67-b7b4-927522fe6a4a', 'checkout.billing', 'en', 'Billing', 'checkout', '2025-11-07T18:34:17.198Z', '2025-11-07T18:34:17.198Z', 'system', '{{STORE_ID}}'),
  ('844f8ae4-cd74-437c-9178-70b64c8bd387', 'account.email', 'en', 'Email', 'account', '2025-11-07T18:34:17.198Z', '2025-11-07T18:34:17.198Z', 'system', '{{STORE_ID}}'),
  ('353963bf-2ace-4203-9d9a-c4b8e440dace', 'account.postal_code', 'en', 'Postal Code', 'account', '2025-11-07T18:34:17.198Z', '2025-11-07T18:34:17.198Z', 'system', '{{STORE_ID}}'),
  ('f6ffe5d0-80e7-4482-b7f9-80474cb921e3', 'common.add', 'en', 'Add', 'common', '2025-11-07T18:34:17.198Z', '2025-11-07T18:34:17.198Z', 'system', '{{STORE_ID}}'),
  ('7bfb49d2-cfda-4341-a86c-ebef1a169908', 'common.cancel', 'en', 'Cancel', 'common', '2025-11-07T18:34:17.198Z', '2025-11-07T18:34:17.198Z', 'system', '{{STORE_ID}}'),
  ('0c4821c1-7164-45de-bafd-cab5b1cbbed0', 'address.default_shipping_badge', 'en', 'Default Shipping', 'address', '2025-11-07T18:34:17.198Z', '2025-11-07T18:34:17.198Z', 'system', '{{STORE_ID}}'),
  ('31cd4e19-1dca-454d-9218-cacd878bf95b', 'address.default_billing_badge', 'en', 'Default Billing', 'address', '2025-11-07T18:34:17.198Z', '2025-11-07T18:34:17.198Z', 'system', '{{STORE_ID}}'),
  ('b7f59fec-0953-4e61-bd1d-940e6417833b', 'address.none_saved', 'en', 'No addresses saved', 'address', '2025-11-07T18:34:17.198Z', '2025-11-07T18:34:17.198Z', 'system', '{{STORE_ID}}'),
  ('4b73b1e9-e785-477f-a1c9-895c7b702d9d', 'address.add_first', 'en', 'Add your first address to make checkout faster.', 'address', '2025-11-07T18:34:17.198Z', '2025-11-07T18:34:17.198Z', 'system', '{{STORE_ID}}'),
  ('4ac44ee4-9480-4078-8471-549fbb6722de', 'success.thank_you', 'en', 'Thank You!', 'order_success', '2025-11-07T18:34:17.198Z', '2025-11-07T18:34:17.198Z', 'system', '{{STORE_ID}}'),
  ('ac18ceaf-6257-41c4-8a6d-88e5f0f39bbe', 'common.pending', 'en', 'Pending', 'common', '2025-11-07T18:34:17.198Z', '2025-11-07T18:34:17.198Z', 'system', '{{STORE_ID}}'),
  ('f0cf6ab4-277d-4e71-bd86-134ebbffc033', 'common.processing', 'en', 'Processing', 'common', '2025-11-07T18:34:17.198Z', '2025-11-07T18:34:17.198Z', 'system', '{{STORE_ID}}'),
  ('43b4bf88-b3a7-4f46-8819-9d6468692c72', 'common.shipped', 'en', 'Shipped', 'common', '2025-11-07T18:34:17.198Z', '2025-11-07T18:34:17.198Z', 'system', '{{STORE_ID}}'),
  ('04618412-4831-44f0-a60d-1f72d9d55721', 'common.delivered', 'en', 'Delivered', 'common', '2025-11-07T18:34:17.198Z', '2025-11-07T18:34:17.198Z', 'system', '{{STORE_ID}}'),
  ('f7861c17-9eed-44d0-a793-ae3af0ba7232', 'common.cancelled', 'en', 'Cancelled', 'common', '2025-11-07T18:34:17.198Z', '2025-11-07T18:34:17.198Z', 'system', '{{STORE_ID}}'),
  ('ded248b0-42a8-4de1-8954-e5632f421931', 'common.refunded', 'en', 'Refunded', 'common', '2025-11-07T18:34:17.198Z', '2025-11-07T18:34:17.198Z', 'system', '{{STORE_ID}}'),
  ('c4594bd4-5d08-4de8-814c-6f48c52ac2e8', 'common.on_hold', 'en', 'On Hold', 'common', '2025-11-07T18:34:17.198Z', '2025-11-07T18:34:17.198Z', 'system', '{{STORE_ID}}'),
  ('d8956ddd-5d16-4e1f-a44d-0c0eecdaccc6', 'common.completed', 'en', 'Completed', 'common', '2025-11-07T18:34:17.198Z', '2025-11-07T18:34:17.198Z', 'system', '{{STORE_ID}}'),
  ('8574b952-ad6d-41ea-9c07-ab126f6c7121', 'common.failed', 'en', 'Failed', 'common', '2025-11-07T18:34:17.198Z', '2025-11-07T18:34:17.198Z', 'system', '{{STORE_ID}}'),
  ('548fa556-5652-4e80-b69d-7bc7bd8faab2', 'common.paid', 'en', 'Paid', 'common', '2025-11-07T18:34:17.198Z', '2025-11-07T18:34:17.198Z', 'system', '{{STORE_ID}}'),
  ('cf0b1311-903e-423c-9adc-c546620261c7', 'address.saving_note', 'en', 'Notte: Address saving for customer accounts is currently limited. If you experience issues, please contact support.', 'address', '2025-11-07T18:34:17.198Z', '2025-11-07T18:34:17.198Z', 'system', '{{STORE_ID}}'),
  ('56d14faf-0316-47a4-bfdf-241b16538bea', 'address.no_shipping', 'en', 'No shipping address', 'address', '2025-11-07T18:34:17.198Z', '2025-11-07T18:34:17.198Z', 'system', '{{STORE_ID}}'),
  ('26b33d14-2a08-461e-b643-7761c9f2d3a4', 'address.default_shipping', 'en', 'Set as default shipping address', 'address', '2025-11-07T18:34:17.198Z', '2025-11-07T18:34:17.198Z', 'system', '{{STORE_ID}}'),
  ('5f7e2fc3-f935-4ffc-a65c-436bebfdebff', 'address.default_billing', 'en', 'Set as default billing address', 'address', '2025-11-07T18:34:17.198Z', '2025-11-07T18:34:17.198Z', 'system', '{{STORE_ID}}'),
  ('893bf043-d245-47de-89ab-d9d843ed183a', 'common.test', 'en', 'test', 'common', '2025-11-07T18:34:17.198Z', '2025-11-07T18:34:17.198Z', 'custom', '{{STORE_ID}}'),
  ('777b2c96-c93e-4c40-9eb7-f1791b9d40c2', 'common.authorized', 'en', 'Authorized', 'common', '2025-11-07T18:34:17.198Z', '2025-11-07T18:34:17.198Z', 'system', '{{STORE_ID}}'),
  ('7aba0dbb-b0b6-4aad-8b5f-11dac071344f', 'cart.coupon_applied', 'en', 'Coupon "{coupon}" applied!', 'cart', '2025-11-07T18:34:17.198Z', '2025-11-07T18:34:17.198Z', 'system', '{{STORE_ID}}'),
  ('0675da96-44bb-489e-b3e0-315f4f9beb9a', 'cart.coupon_removed', 'en', 'Coupon removed.', 'cart', '2025-11-07T18:34:17.198Z', '2025-11-07T18:34:17.198Z', 'system', '{{STORE_ID}}'),
  ('8b474753-7b80-4fc2-b7dd-ba8b97df44dc', 'cart.item_removed', 'en', 'Item removed from cart.', 'cart', '2025-11-07T18:34:17.198Z', '2025-11-07T18:34:17.198Z', 'system', '{{STORE_ID}}'),
  ('bb177451-6b9a-4810-8076-590c8c9ccfbc', 'common.active_filters', 'en', 'Active Filters', 'common', '2025-11-07T18:34:17.198Z', '2025-11-07T18:34:17.198Z', 'system', '{{STORE_ID}}'),
  ('873ae236-93ea-4fb2-a115-516e60f6b83b', 'common.added_to_cart_error', 'en', 'Failed to add to cart. Please try again.', 'common', '2025-11-07T18:34:17.198Z', '2025-11-07T18:34:17.198Z', 'system', '{{STORE_ID}}'),
  ('291ff185-a71b-4452-8ea0-eaad9764f4a0', 'common.added_to_cart_success', 'en', ' added to cart successfully!', 'common', '2025-11-07T18:34:17.198Z', '2025-11-07T18:34:17.198Z', 'system', '{{STORE_ID}}'),
  ('cf4f606c-7e6b-4496-8fd4-e9fb1ddd64ed', 'common.apply_filters', 'en', 'Apply Filters', 'common', '2025-11-07T18:34:17.198Z', '2025-11-07T18:34:17.198Z', 'system', '{{STORE_ID}}'),
  ('b759f8d2-cb02-494c-b749-7a2b31c02fb9', 'common.clear_all', 'en', 'Clear All', 'common', '2025-11-07T18:34:17.198Z', '2025-11-07T18:34:17.198Z', 'system', '{{STORE_ID}}'),
  ('ac638df6-ea7d-46f3-86a1-4956a08cba9a', 'common.continue_shopping', 'en', 'Continue Shopping', 'common', '2025-11-07T18:34:17.198Z', '2025-11-07T18:34:17.198Z', 'system', '{{STORE_ID}}'),
  ('812e6450-1245-41fd-8591-d181f2a1543e', 'common.filter_by', 'en', 'Filter By', 'common', '2025-11-07T18:34:17.198Z', '2025-11-07T18:34:17.198Z', 'system', '{{STORE_ID}}'),
  ('faf6106a-cf98-4fa5-96ee-445f87c4db16', 'common.filters', 'en', 'Filters', 'common', '2025-11-07T18:34:17.198Z', '2025-11-07T18:34:17.198Z', 'system', '{{STORE_ID}}'),
  ('07eadd37-86c4-4a41-b4d8-2e1428eb6efb', 'common.my_cart', 'en', 'My Cart', 'common', '2025-11-07T18:34:17.198Z', '2025-11-07T18:34:17.198Z', 'system', '{{STORE_ID}}'),
  ('82863fdf-9d3d-4f6b-b869-217cc793c009', 'common.of', 'en', 'of', 'common', '2025-11-07T18:34:17.198Z', '2025-11-07T18:34:17.198Z', 'system', '{{STORE_ID}}'),
  ('cfc6b9cd-783f-40a7-a374-2ca5c86823f7', 'common.price', 'en', 'Price', 'common', '2025-11-07T18:34:17.198Z', '2025-11-07T18:34:17.198Z', 'system', '{{STORE_ID}}'),
  ('64b47056-247d-4283-85fb-38e40fbec025', 'common.products', 'en', 'products', 'common', '2025-11-07T18:34:17.198Z', '2025-11-07T18:34:17.198Z', 'system', '{{STORE_ID}}'),
  ('dc84819f-95d8-4196-99c4-4df6eeb23dfc', 'common.show_more', 'en', 'Show More', 'common', '2025-11-07T18:34:17.198Z', '2025-11-07T18:34:17.198Z', 'system', '{{STORE_ID}}'),
  ('d2d35938-4bbd-4248-8d1b-729270db55f0', 'common.sign_in', 'en', 'Sign In', 'common', '2025-11-07T18:34:17.198Z', '2025-11-07T18:34:17.198Z', 'system', '{{STORE_ID}}'),
  ('f61032bc-fbd8-41ca-9120-d4e51b1ed2f9', 'common.sort_by', 'en', 'Sort By', 'sort_by', '2025-11-07T18:34:17.198Z', '2025-11-07T18:34:17.198Z', 'system', '{{STORE_ID}}'),
  ('e080005c-1d49-40fa-82e5-50925de4160a', 'common.sort_name_asc', 'en', 'Name (A-Z)', 'common', '2025-11-07T18:34:17.198Z', '2025-11-07T18:34:17.198Z', 'system', '{{STORE_ID}}'),
  ('dc14290c-6535-4ec8-8ea5-63fb59449f42', 'discount.view_eligible_products', 'en', 'View eligible products', 'discount', '2025-11-07T18:34:17.198Z', '2025-11-12T22:28:53.341Z', 'system', '{{STORE_ID}}'),
  ('648e3a44-e43b-44e1-a84e-0b54f3919c77', 'common.sort_name_desc', 'en', 'Name (Z-A)', 'common', '2025-11-07T18:34:17.198Z', '2025-11-07T18:34:17.198Z', 'system', '{{STORE_ID}}'),
  ('ac907994-48a5-4c45-bec5-e57e03c39880', 'common.sort_newest', 'en', 'Newest First', 'common', '2025-11-07T18:34:17.198Z', '2025-11-07T18:34:17.198Z', 'system', '{{STORE_ID}}'),
  ('7ba33328-c98e-46e1-af18-2a852fad99ec', 'common.sort_position', 'en', 'Position', 'common', '2025-11-07T18:34:17.198Z', '2025-11-07T18:34:17.198Z', 'system', '{{STORE_ID}}'),
  ('75840ef0-b730-46f5-923b-0c05b3ca2900', 'common.sort_price_high', 'en', 'Price: High to Low', 'common', '2025-11-07T18:34:17.198Z', '2025-11-07T18:34:17.198Z', 'system', '{{STORE_ID}}'),
  ('26875044-dba2-46c8-ad20-8fb451f4b432', 'common.sort_price_low', 'en', 'Price: Low to High', 'common', '2025-11-07T18:34:17.198Z', '2025-11-07T18:34:17.198Z', 'system', '{{STORE_ID}}'),
  ('f0913507-dcda-472e-af87-65f507186272', 'messages.passwords_no_match', 'en', 'Passwords do not match.', 'validation', '2025-11-07T18:34:17.198Z', '2025-11-07T18:34:17.198Z', 'system', '{{STORE_ID}}'),
  ('6a3aa475-53f9-406d-b62e-e2d4957b0203', 'common.already_registered_login', 'en', 'Already Registered? Login!', 'common', '2025-11-07T18:34:17.198Z', '2025-11-07T18:34:17.198Z', 'system', '{{STORE_ID}}'),
  ('18ac8fac-e44a-4242-9c85-89650a6e4b80', 'common.apply', 'en', 'Apply', 'common', '2025-11-07T18:34:17.198Z', '2025-11-07T18:34:17.198Z', 'system', '{{STORE_ID}}'),
  ('014d727a-0d71-42b0-abfc-363fe65a3b9c', 'common.apply_coupon', 'en', 'Apply Coupon', 'common', '2025-11-07T18:34:17.198Z', '2025-11-07T18:34:17.198Z', 'system', '{{STORE_ID}}'),
  ('3f3b9d60-eef3-47de-bdcb-cc7cc19c478f', 'common.category_description', 'en', 'Discover our amazing collection of products in this category. Browse through our curated selection and find exactly what you need.', 'common', '2025-11-07T18:34:17.198Z', '2025-11-07T18:34:17.198Z', 'system', '{{STORE_ID}}'),
  ('c8a8700a-04e2-4734-a9a1-aa87aa03cf92', 'common.checkout', 'en', 'Checkout', 'common', '2025-11-07T18:34:17.198Z', '2025-11-07T18:34:17.198Z', 'system', '{{STORE_ID}}'),
  ('1e8d40b1-5367-4081-9cf4-ae4f8f4dbd86', 'common.discount', 'en', 'Discount', 'common', '2025-11-07T18:34:17.198Z', '2025-11-07T18:34:17.198Z', 'system', '{{STORE_ID}}'),
  ('78c659ef-e04b-4a35-bdcc-3533be577905', 'common.create_account', 'en', 'Create My Account', 'common', '2025-11-07T18:34:17.198Z', '2025-11-12T22:28:53.341Z', 'system', '{{STORE_ID}}'),
  ('33c8b1b9-cb26-4b9d-ad59-274774be3d8a', 'common.add_products_checkout', 'en', 'Add products before checkout', 'common', '2025-11-07T18:34:17.198Z', '2025-11-12T22:28:53.341Z', 'system', '{{STORE_ID}}'),
  ('cbf7d913-2824-4bd6-98c4-b127594ed8e7', 'common.order_summary', 'en', 'Order Summary', 'common', '2025-11-07T18:34:17.198Z', '2025-11-07T18:34:17.198Z', 'system', '{{STORE_ID}}'),
  ('01c4e06f-3138-4825-b93e-e81adf896ebe', 'common.proceed_now', 'en', 'Proceed now', 'common', '2025-11-07T18:34:17.198Z', '2025-11-07T18:34:17.198Z', 'system', '{{STORE_ID}}'),
  ('f9857d04-f3ac-4481-8139-d4441888df5a', 'common.processing_order', 'en', 'Processing your order...', 'common', '2025-11-07T18:34:17.198Z', '2025-11-07T18:34:17.198Z', 'system', '{{STORE_ID}}'),
  ('1ebc1cc9-87e0-4d3a-a198-25f40d67c9b4', 'common.remove', 'en', 'Remove', 'common', '2025-11-07T18:34:17.198Z', '2025-11-07T18:34:17.198Z', 'system', '{{STORE_ID}}'),
  ('da304738-eb36-4a6c-a3b9-a2fd7c65807b', 'common.subtotal', 'en', 'Subtotal', 'common', '2025-11-07T18:34:17.198Z', '2025-11-07T18:34:17.198Z', 'system', '{{STORE_ID}}'),
  ('e6c16764-56e2-46f5-a03a-9cf3074d5f54', 'common.tax', 'en', 'Tax', 'common', '2025-11-07T18:34:17.198Z', '2025-11-07T18:34:17.198Z', 'system', '{{STORE_ID}}'),
  ('a0b7d960-4672-4179-bdd6-e3a621239a1d', 'common.terms_agreement', 'en', 'By signing in, you agree to our Terms of Service and Privacy Policy', 'common', '2025-11-07T18:34:17.198Z', '2025-11-07T18:34:17.198Z', 'system', '{{STORE_ID}}'),
  ('9dee1130-2bd0-4bb0-87c0-edc0c85e2af3', 'common.total', 'en', 'Total', 'common', '2025-11-07T18:34:17.198Z', '2025-11-07T18:34:17.198Z', 'system', '{{STORE_ID}}'),
  ('4a443dfe-0264-405f-9926-7673c68ba05e', 'common.welcome_back', 'en', 'Welcome Back', 'common', '2025-11-07T18:34:17.198Z', '2025-11-07T18:34:17.198Z', 'system', '{{STORE_ID}}'),
  ('4a443dfe-0264-405f-9926-7673c68ba05e', 'common.welcome_back', 'en', 'Welcome Back', 'common', '2025-11-07T18:34:17.198Z', '2025-11-07T18:34:17.198Z', 'system', '{{STORE_ID}}'),
  ('70f32b10-a77f-4d0e-afdc-5a61f9a7c620', 'stock.out_of_stock_label', 'en', 'Out of Stock', 'stock', '2025-11-07T18:34:17.198Z', '2025-11-07T18:34:17.198Z', 'system', '{{STORE_ID}}'),
  ('8ccfc5c8-ff23-4d04-93ad-2773cec8de3f', 'order.placed', 'en', 'Placed', 'order', '2025-11-07T18:34:17.198Z', '2025-11-07T18:34:17.198Z', 'system', '{{STORE_ID}}'),
  ('dbbd2464-a8b1-41b0-baa9-674863dd4be8', 'order.store', 'en', 'Store', 'order', '2025-11-07T18:34:17.198Z', '2025-11-07T18:34:17.198Z', 'system', '{{STORE_ID}}'),
  ('84dee4d4-0a95-4efd-aab7-329e10ef89c6', 'order.payment_information', 'en', 'Payment Information', 'order', '2025-11-07T18:34:17.198Z', '2025-11-07T18:34:17.198Z', 'system', '{{STORE_ID}}'),
  ('6b08f74f-253d-46ee-abc7-6c4c225d0078', 'order.total_paid', 'en', 'Total Paid', 'order', '2025-11-07T18:34:17.198Z', '2025-11-07T18:34:17.198Z', 'system', '{{STORE_ID}}'),
  ('a7f2c9b3-2040-44ef-b57c-524c5d38d9e8', 'order.items', 'en', 'Order Items', 'order', '2025-11-07T18:34:17.198Z', '2025-11-07T18:34:17.198Z', 'system', '{{STORE_ID}}'),
  ('83a11951-13b0-40c6-9aa7-25de6ae71d87', 'order.status_notes', 'en', 'Status Notes', 'order', '2025-11-07T18:34:17.198Z', '2025-11-07T18:34:17.198Z', 'system', '{{STORE_ID}}'),
  ('354d2bae-25b8-4187-9934-ea05f1bae44f', 'order.cancel', 'en', 'Cancel Order', 'order', '2025-11-07T18:34:17.198Z', '2025-11-07T18:34:17.198Z', 'system', '{{STORE_ID}}'),
  ('2dfea449-4277-4216-8def-d30b882f661b', 'order.cancelling', 'en', 'Cancelling...', 'order', '2025-11-07T18:34:17.198Z', '2025-11-07T18:34:17.198Z', 'system', '{{STORE_ID}}'),
  ('a8b9ee54-4557-4d61-968e-68935c2d2aa5', 'order.request_return', 'en', 'Request Return', 'order', '2025-11-07T18:34:17.198Z', '2025-11-07T18:34:17.198Z', 'system', '{{STORE_ID}}'),
  ('19dc69d4-960c-4d90-a9df-c41be5d4c606', 'order.requesting', 'en', 'Requesting...', 'order', '2025-11-07T18:34:17.198Z', '2025-11-07T18:34:17.198Z', 'system', '{{STORE_ID}}'),
  ('786e1d0b-0a5a-4f5a-8b27-01dbd4c71f9a', 'order.date', 'en', 'Order Date', 'order', '2025-11-07T18:34:17.198Z', '2025-11-07T18:34:17.198Z', 'system', '{{STORE_ID}}'),
  ('eac41134-e306-4439-bbf3-0a0c1d806815', 'common.enter_coupon_code', 'en', 'Please enter a coupon code', 'common', '2025-11-07T18:34:17.198Z', '2025-11-12T22:28:53.341Z', 'system', '{{STORE_ID}}'),
  ('db0e8d13-a2ea-4953-af7c-bc7f71269db1', 'common.yes', 'en', 'Yes', 'common', '2025-11-07T18:34:17.198Z', '2025-11-07T18:34:17.198Z', 'system', '{{STORE_ID}}'),
  ('ccdf4d9c-a4d2-49a1-997c-fb1b74177785', 'order.payment_status', 'en', 'Payment Status', 'order', '2025-11-07T18:34:17.198Z', '2025-11-07T18:34:17.198Z', 'system', '{{STORE_ID}}'),
  ('03051f79-8c8f-4648-a1c4-2ae65dfcf25d', 'common.download', 'en', 'Download', 'common', '2025-11-07T18:34:17.198Z', '2025-11-07T18:34:17.198Z', 'system', '{{STORE_ID}}'),
  ('04fdd913-67fc-4996-96f1-9904856b4f3b', 'common.upload', 'en', 'Upload', 'common', '2025-11-07T18:34:17.198Z', '2025-11-07T18:34:17.198Z', 'system', '{{STORE_ID}}'),
  ('a948cb7b-e4c4-4f42-9168-433aac5627f3', 'common.select', 'en', 'Select', 'common', '2025-11-07T18:34:17.198Z', '2025-11-07T18:34:17.198Z', 'system', '{{STORE_ID}}'),
  ('0c31eab2-7cef-471a-901b-ac13ca0327f4', 'common.none', 'en', 'None', 'common', '2025-11-07T18:34:17.198Z', '2025-11-07T18:34:17.198Z', 'system', '{{STORE_ID}}'),
  ('0a6104ec-ac31-4f21-ac8e-ced29d5619e4', 'common.search_products', 'en', 'Search products...', 'common', '2025-11-07T18:34:17.198Z', '2025-11-07T18:34:17.198Z', 'system', '{{STORE_ID}}'),
  ('a3aa670a-3f51-49ec-81a1-54ea9d798058', 'navigation.profile', 'en', 'Profile', 'navigation', '2025-11-07T18:34:17.198Z', '2025-11-07T18:34:17.198Z', 'system', '{{STORE_ID}}'),
  ('601fb9e6-71fb-4ef5-9997-9f981282fce1', 'navigation.admin', 'en', 'Admin', 'navigation', '2025-11-07T18:34:17.198Z', '2025-11-07T18:34:17.198Z', 'system', '{{STORE_ID}}'),
  ('8999d09a-9295-4bd6-8f11-144a29c2afe4', 'navigation.storefront', 'en', 'Storefront', 'navigation', '2025-11-07T18:34:17.198Z', '2025-11-07T18:34:17.198Z', 'system', '{{STORE_ID}}'),
  ('f3d94c32-b2bd-44bd-bd70-a341d7ac9b94', 'product.name', 'en', 'Product Name', 'product', '2025-11-07T18:34:17.198Z', '2025-11-07T18:34:17.198Z', 'system', '{{STORE_ID}}'),
  ('4af06df4-eda6-4091-b259-853a14f4f9a6', 'product.in_stock', 'en', 'In Stock', 'product', '2025-11-07T18:34:17.198Z', '2025-11-07T18:34:17.198Z', 'system', '{{STORE_ID}}'),
  ('5af06df4-eda6-4091-b259-853a14f4f9a6', 'product.out_of_stock', 'en', 'Out of Stock', 'product', '2025-11-07T18:34:17.198Z', '2025-11-07T18:34:17.198Z', 'system', '{{STORE_ID}}'),
  ('01ff44ee-27fa-4a78-9a37-cb5013090b60', 'common.confirm_password', 'en', 'Confirm Password', 'common', '2025-11-07T18:34:17.198Z', '2025-11-07T18:34:17.198Z', 'system', '{{STORE_ID}}'),
  ('e31519d3-a933-4456-af16-fa69117b8dfb', 'common.could_not_apply_coupon', 'en', 'Could not apply coupon', 'common', '2025-11-07T18:34:17.198Z', '2025-11-07T18:34:17.198Z', 'system', '{{STORE_ID}}'),
  ('a0ef31ad-6b27-4edb-a1c1-6a73abad0ef1', 'cart.cart_empty', 'en', 'Cart is empty', 'common', '2025-11-07T18:34:17.198Z', '2025-11-07T18:34:17.198Z', 'system', '{{STORE_ID}}'),
  ('b0ef31ad-6b27-4edb-a1c1-6a73abad0ef1', 'cart.cart_empty_message', 'en', 'Looks like you haven''t added anything to your cart yet.', 'common', '2025-11-07T18:34:17.198Z', '2025-11-07T18:34:17.198Z', 'system', '{{STORE_ID}}'),
  ('fa5731ca-2345-4fc4-90c3-bd5938f22123', 'product.buy_now', 'en', 'Buy Now', 'product', '2025-11-07T18:34:17.198Z', '2025-11-07T18:34:17.198Z', 'system', '{{STORE_ID}}'),
  ('25cf5b20-7dfc-46e0-8731-255c1139ea2d', 'product.quick_view', 'en', 'Quick View', 'product', '2025-11-07T18:34:17.198Z', '2025-11-07T18:34:17.198Z', 'system', '{{STORE_ID}}'),
  ('bed23695-4d1d-4cb0-a551-c3b4e7fc0fbb', 'product.details', 'en', 'Product Details', 'product', '2025-11-07T18:34:17.198Z', '2025-11-07T18:34:17.198Z', 'system', '{{STORE_ID}}'),
  ('02d1172b-1ae4-4fbf-b843-bc063eecde7b', 'product.reviews', 'en', 'Reviews', 'product', '2025-11-07T18:34:17.198Z', '2025-11-07T18:34:17.198Z', 'system', '{{STORE_ID}}'),
  ('db40b061-e251-425f-b0c9-86afd842ed27', 'checkout.cart', 'en', 'Shopping Cart', 'checkout', '2025-11-07T18:34:17.198Z', '2025-11-07T18:34:17.198Z', 'system', '{{STORE_ID}}'),
  ('1ec53f24-90f1-4f59-9594-b54282b1e04e', 'error.blacklist.checkout', 'en', 'This email address cannot be used for checkout. Please contact support for assistance.', 'error', '2025-11-07T18:34:17.198Z', '2025-11-07T18:34:17.198Z', 'system', '{{STORE_ID}}'),
  ('dc3fac6e-ed5e-4ab3-a76a-139441e1cbd0', 'common.edit', 'en', 'Edit', 'common', '2025-11-07T18:34:17.198Z', '2025-11-07T18:34:17.198Z', 'system', '{{STORE_ID}}'),
  ('0195124c-35a3-44b5-959b-2aa35f857742', 'common.delete', 'en', 'Delete', 'common', '2025-11-07T18:34:17.198Z', '2025-11-07T18:34:17.198Z', 'system', '{{STORE_ID}}'),
  ('30b4ff66-9ad8-4aed-be8e-d2b407849fa6', 'common.save', 'en', 'Save', 'common', '2025-11-07T18:34:17.198Z', '2025-11-07T18:34:17.198Z', 'system', '{{STORE_ID}}'),
  ('b5d13e5d-3c40-41c6-8380-aadc6e6d3871', 'common.submit', 'en', 'Submit', 'common', '2025-11-07T18:34:17.198Z', '2025-11-07T18:34:17.198Z', 'system', '{{STORE_ID}}'),
  ('00b6ab21-f092-4ca2-89be-b773dfd63204', 'common.close', 'en', 'Close', 'common', '2025-11-07T18:34:17.198Z', '2025-11-07T18:34:17.198Z', 'system', '{{STORE_ID}}'),
  ('e393a518-20d4-4e13-9cd3-696575b6359f', 'common.error', 'en', 'Error', 'common', '2025-11-07T18:34:17.198Z', '2025-11-07T18:34:17.198Z', 'system', '{{STORE_ID}}'),
  ('43340d75-8def-4fbd-865e-9b5dda16ef18', 'common.free', 'en', 'Free', 'common', '2025-11-07T18:34:17.198Z', '2025-11-07T18:34:17.198Z', 'system', '{{STORE_ID}}'),
  ('1252283a-04c6-45fe-a13f-6915562f9457', 'common.logout', 'en', 'Logout', 'common', '2025-11-07T18:34:17.198Z', '2025-11-07T18:34:17.198Z', 'system', '{{STORE_ID}}'),
  ('7ba2b923-99d5-4b67-9802-c51eb34696cd', 'common.place_order', 'en', 'Place Order', 'common', '2025-11-07T18:34:17.198Z', '2025-11-07T18:34:17.198Z', 'system', '{{STORE_ID}}'),
  ('f54022f1-9099-478c-b5a8-341d61f77556', 'common.shipping', 'en', 'Shipping', 'common', '2025-11-07T18:34:17.198Z', '2025-11-07T18:34:17.198Z', 'system', '{{STORE_ID}}'),
  ('97cf455b-f571-4de4-82cf-88445da008ad', 'common.shipping_address', 'en', 'Shipping Address', 'common', '2025-11-07T18:34:17.198Z', '2025-11-07T18:34:17.198Z', 'system', '{{STORE_ID}}'),
  ('a8fbffea-e141-4585-84e0-fc1e602cd309', 'common.shipping_method', 'en', 'Shipping Method', 'common', '2025-11-07T18:34:17.198Z', '2025-11-07T18:34:17.198Z', 'system', '{{STORE_ID}}'),
  ('9167c20e-c6f9-468d-b73b-5efe5179dc4e', 'common.wishlist', 'en', 'Wishlist', 'common', '2025-11-07T18:34:17.198Z', '2025-11-07T18:34:17.198Z', 'system', '{{STORE_ID}}'),
  ('3d4e18a5-9ed5-4cc6-bbc8-43ffcbc1b94e', 'order.delivery_date', 'en', 'Delivery Date', 'order', '2025-11-07T18:34:17.198Z', '2025-11-07T18:34:17.198Z', 'system', '{{STORE_ID}}'),
  ('90ce65e5-ddd1-4189-a2e5-3e28778f34fd', 'checkout.delivery_settings', 'en', 'Delivery Settings', 'checkout', '2025-11-07T18:34:17.198Z', '2025-11-07T18:34:17.198Z', 'system', '{{STORE_ID}}'),
  ('098c3011-80a1-41fa-a34b-6e04a4bfba0b', 'checkout.preferred_delivery_date', 'en', 'Preferred Delivery Date', 'checkout', '2025-11-07T18:34:17.198Z', '2025-11-07T18:34:17.198Z', 'system', '{{STORE_ID}}'),
  ('0b5a334f-b9b5-43f0-bf3f-139254a215e1', 'checkout.preferred_time_slot', 'en', 'Preferred Time Slot', 'checkout', '2025-11-07T18:34:17.198Z', '2025-11-07T18:34:17.198Z', 'system', '{{STORE_ID}}'),
  ('c3be408f-96bb-4ed4-966e-7d2f19d61bc9', 'checkout.same_as_shipping', 'en', 'Same as shipping address', 'checkout', '2025-11-07T18:34:17.198Z', '2025-11-07T18:34:17.198Z', 'system', '{{STORE_ID}}'),
  ('434395df-dbfa-4384-8628-261d82226e82', 'common.added_to_cart', 'en', 'added to cart successfully!', 'common', '2025-11-07T18:34:17.198Z', '2025-11-07T18:34:17.198Z', 'system', '{{STORE_ID}}'),
  ('6f32906d-ffed-45c8-b24b-214063ec0bb6', 'common.adding', 'en', 'Adding...', 'common', '2025-11-07T18:34:17.198Z', '2025-11-07T18:34:17.198Z', 'system', '{{STORE_ID}}'),
  ('88cb27ee-82bd-42e4-9b53-1ba6c3bb4541', 'common.error_adding', 'en', 'Error adding', 'common', '2025-11-07T18:34:17.198Z', '2025-11-07T18:34:17.198Z', 'system', '{{STORE_ID}}'),
  ('9b106463-ba0e-44f8-ab34-5ee69d01b530', 'common.failed_to_add', 'en', 'Failed to add', 'common', '2025-11-07T18:34:17.198Z', '2025-11-07T18:34:17.198Z', 'system', '{{STORE_ID}}'),
  ('74a62725-84f6-4ca5-9769-7e153a25db73', 'common.please_try_again', 'en', 'Please try again', 'common', '2025-11-07T18:34:17.198Z', '2025-11-07T18:34:17.198Z', 'system', '{{STORE_ID}}'),
  ('c20d2180-02d0-4c7e-b619-ae4590e450ca', 'common.to_cart', 'en', 'to cart', 'common', '2025-11-07T18:34:17.198Z', '2025-11-07T18:34:17.198Z', 'system', '{{STORE_ID}}'),
  ('663ca7c3-4e63-4896-9caf-a89015114a9b', 'product.price_breakdown', 'en', 'Price Breakdown', 'product', '2025-11-07T18:34:17.198Z', '2025-11-07T18:34:17.198Z', 'system', '{{STORE_ID}}'),
  ('0fe9b01a-6ba2-4aac-9048-87e135ccfd7e', 'product.selected_options', 'en', 'Selected Options', 'product', '2025-11-07T18:34:17.198Z', '2025-11-07T18:34:17.198Z', 'system', '{{STORE_ID}}'),
  ('502d15c4-170f-438f-9cf0-03b45725b028', 'product.total_price', 'en', 'Total Price', 'product', '2025-11-07T18:34:17.198Z', '2025-11-07T18:34:17.198Z', 'system', '{{STORE_ID}}'),
  ('8f80ce33-942f-494f-91f9-90f760b0575a', 'order.delivery_time', 'en', 'Delivery Time', 'order', '2025-11-07T18:34:17.198Z', '2025-11-07T18:34:17.198Z', 'system', '{{STORE_ID}}'),
  ('8dfb1f54-a6b2-4351-b65a-3b921fb8a26e', 'order.items_processing', 'en', 'Order items are being processed...', 'order', '2025-11-07T18:34:17.198Z', '2025-11-07T18:34:17.198Z', 'system', '{{STORE_ID}}'),
  ('34ac56c1-85d9-4be0-869a-99310a8889d3', 'order.successful', 'en', 'Your order was successful and will be fulfilled.', 'order', '2025-11-07T18:34:17.198Z', '2025-11-07T18:34:17.198Z', 'system', '{{STORE_ID}}'),
  ('14258db9-2692-4ab5-a29e-2a7aedb3d847', 'order.details', 'en', 'Order Details', 'order', '2025-11-07T18:34:17.198Z', '2025-11-07T18:34:17.198Z', 'system', '{{STORE_ID}}'),
  ('ff793e66-1550-4dfe-aaa0-18c6eb9fd7a8', 'order.total_amount', 'en', 'Total Amount', 'order', '2025-11-07T18:34:17.198Z', '2025-11-07T18:34:17.198Z', 'system', '{{STORE_ID}}'),
  ('712fbb03-4666-470b-a540-ba239f2b022a', 'order.unit_price', 'en', 'Unit Price', 'order', '2025-11-07T18:34:17.198Z', '2025-11-07T18:34:17.198Z', 'system', '{{STORE_ID}}'),
  ('4766dfbf-ccb6-47e6-a74d-b5caa52bbc79', 'order.total', 'en', 'Order Total', 'order', '2025-11-07T18:34:17.198Z', '2025-11-07T18:34:17.198Z', 'system', '{{STORE_ID}}'),
  ('81b3b938-b73e-4d24-9c7b-0a7b0bbcc92e', 'order.not_found', 'en', 'Order Not Found', 'order', '2025-11-07T18:34:17.198Z', '2025-11-07T18:34:17.198Z', 'system', '{{STORE_ID}}'),
  ('7eb0c758-9c3e-4b2c-951a-9028adb0a96e', 'order.check_email', 'en', 'Please check your email for order confirmation or contact support.', 'order', '2025-11-07T18:34:17.198Z', '2025-11-07T18:34:17.198Z', 'system', '{{STORE_ID}}'),
  ('d8bf1806-04db-41d6-84f3-fe499af052de', 'message.warning', 'en', 'Warning!', 'common', '2025-11-07T18:34:17.198Z', '2025-11-07T18:34:17.198Z', 'system', '{{STORE_ID}}'),
  ('f98310fa-8a06-44bb-9e00-b7cf1cae2b02', 'checkout.applied', 'en', 'Applied:', 'checkout', '2025-11-07T18:34:17.198Z', '2025-11-07T18:34:17.198Z', 'system', '{{STORE_ID}}'),
  ('544cbe3d-69ec-4159-ab0f-45b4c2191d31', 'checkout.continue', 'en', 'Continue', 'checkout', '2025-11-07T18:34:17.198Z', '2025-11-07T18:34:17.198Z', 'system', '{{STORE_ID}}'),
  ('f8ae2f79-93d6-49e0-aec9-9e312049e9fe', 'checkout.custom_options', 'en', 'Custom Options', 'checkout', '2025-11-07T18:34:17.198Z', '2025-11-07T18:34:17.198Z', 'system', '{{STORE_ID}}'),
  ('a1e21a48-c153-4731-bddc-a55a87b0c74d', 'checkout.default', 'en', 'Default', 'checkout', '2025-11-07T18:34:17.198Z', '2025-11-07T18:34:17.198Z', 'system', '{{STORE_ID}}'),
  ('9bf5a6a2-4f0b-414d-b6c8-d38a1907b0df', 'checkout.edit_info', 'en', 'Edit Info', 'checkout', '2025-11-07T18:34:17.198Z', '2025-11-07T18:34:17.198Z', 'system', '{{STORE_ID}}'),
  ('374f4b17-13f2-47fe-af17-451f363a6ccd', 'checkout.items_in_cart', 'en', 'Items in Cart', 'checkout', '2025-11-07T18:34:17.198Z', '2025-11-07T18:34:17.198Z', 'system', '{{STORE_ID}}'),
  ('c4df70c2-6946-4ee8-a911-d57e9a8c5932', 'checkout.off', 'en', 'off', 'checkout', '2025-11-07T18:34:17.198Z', '2025-11-07T18:34:17.198Z', 'system', '{{STORE_ID}}'),
  ('7926f9d4-0cbc-482c-b992-c0fc44728b90', 'checkout.payment_fee', 'en', 'Payment Fee', 'checkout', '2025-11-07T18:34:17.198Z', '2025-11-07T18:34:17.198Z', 'system', '{{STORE_ID}}'),
  ('07e3a6fd-939c-4731-a26e-0cdfbd80ee66', 'checkout.processing', 'en', 'Processing...', 'checkout', '2025-11-07T18:34:17.198Z', '2025-11-07T18:34:17.198Z', 'system', '{{STORE_ID}}'),
  ('07e9b920-bad0-482d-8637-62727ab536d0', 'message.password_mismatch', 'en', 'Passwords do not match', 'common', '2025-11-07T18:34:17.198Z', '2025-11-07T18:34:17.198Z', 'system', '{{STORE_ID}}'),
  ('8ad2a988-5678-4277-bcac-31e85846b418', 'common.coupon_not_apply', 'en', 'Coupon does not apply', 'common', '2025-11-07T18:34:17.198Z', '2025-11-07T18:34:17.198Z', 'system', '{{STORE_ID}}'),
  ('b7941f5c-d900-49e2-8cde-ec53f123ed8d', 'admin.manage', 'en', 'Manage', 'admin', '2025-11-07T18:34:17.198Z', '2025-11-07T18:34:17.198Z', 'system', '{{STORE_ID}}'),
  ('42cdf4e1-33a5-4e13-a4e9-1f800b29e6f0', 'admin.create', 'en', 'Create', 'admin', '2025-11-07T18:34:17.198Z', '2025-11-07T18:34:17.198Z', 'system', '{{STORE_ID}}'),
  ('138342fd-6db0-4757-ac5f-dada4d847c77', 'order.loading', 'en', 'Loading your order details...', 'order', '2025-11-07T18:34:17.198Z', '2025-11-07T18:34:17.198Z', 'system', '{{STORE_ID}}'),
  ('4188c71a-6778-4758-869a-4fa29bd7b2c2', 'wishlist.your', 'en', 'Your Wishlist', 'wishlist', '2025-11-07T18:34:17.198Z', '2025-11-07T18:34:17.198Z', 'system', '{{STORE_ID}}'),
  ('24f1463b-be84-4472-8f6c-ad5d8b1e5a1f', 'wishlist.items', 'en', 'Wishlist Items', 'wishlist', '2025-11-07T18:34:17.198Z', '2025-11-07T18:34:17.198Z', 'system', '{{STORE_ID}}'),
  ('11b331c3-821d-49e4-a98f-9b52fd9bcaa9', 'wishlist.saved_for_later', 'en', 'Saved for later', 'wishlist', '2025-11-07T18:34:17.198Z', '2025-11-07T18:34:17.198Z', 'system', '{{STORE_ID}}'),
  ('b69c7265-369e-4ba7-bcce-17a62e7e4137', 'error.blacklist.login', 'en', 'Your account has been disabled. Please contact support for assistance.', 'error', '2025-11-07T18:34:17.198Z', '2025-11-07T18:34:17.198Z', 'system', '{{STORE_ID}}'),
  ('4cd31afc-c706-424b-9396-d3888e0f867f', 'common.next', 'en', 'Next', 'common', '2025-11-07T18:34:17.198Z', '2025-11-07T18:34:17.198Z', 'system', '{{STORE_ID}}'),
  ('d8bb437e-5982-4263-9d5e-eb309a4795a6', 'common.home', 'en', 'Home', 'common', '2025-11-07T18:34:17.198Z', '2025-11-07T18:34:17.198Z', 'system', '{{STORE_ID}}'),
  ('6d7db734-8d71-41ba-9344-c2db76ed07f0', 'common.view_all', 'en', 'View All', 'common', '2025-11-07T18:34:17.198Z', '2025-11-07T18:34:17.198Z', 'system', '{{STORE_ID}}'),
  ('1e0e9d67-ed78-467e-a447-ce3ba773116c', 'common.search_country', 'en', 'Search country...', 'common', '2025-11-07T18:34:17.198Z', '2025-11-07T18:34:17.198Z', 'system', '{{STORE_ID}}'),
  ('ce1e02c5-afe5-4d93-aba7-829cc4a3bf1e', 'product.add_to_cart', 'en', 'Add to Cart', 'product', '2025-11-07T18:34:17.198Z', '2025-11-07T18:34:17.198Z', 'system', '{{STORE_ID}}'),
  ('b52700a3-6d8c-4042-ad4e-652df6c8cb82', 'message.invalid_email', 'en', 'Invalid email address', 'common', '2025-11-07T18:34:17.198Z', '2025-11-07T18:34:17.198Z', 'system', '{{STORE_ID}}'),
  ('dce06882-6e9b-40b3-8d24-840015d90a1f', 'stock.low_stock_label', 'en', 'Low stock{, {just {quantity} {item} left}}', 'stock', '2025-11-07T18:34:17.198Z', '2025-11-07T18:34:17.198Z', 'system', '{{STORE_ID}}'),
  ('7ff979c7-e102-4c9a-a0f9-0b5c94bbb8a9', 'common.additional_products', 'en', 'Additional Products', 'common', '2025-11-07T18:34:17.198Z', '2025-11-07T18:34:17.198Z', 'system', '{{STORE_ID}}'),
  ('e423adac-5a0f-4880-a372-bdabf0a42098', 'common.coupon_not_active', 'en', 'This coupon is not yet active', 'common', '2025-11-07T18:34:17.198Z', '2025-11-12T22:28:53.341Z', 'system', '{{STORE_ID}}'),
  ('133eadd2-e0ed-4e05-b1e4-a81011265987', 'checkout.step_2step_1', 'en', 'Information', 'checkout', '2025-11-07T18:34:17.198Z', '2025-11-07T18:34:17.198Z', 'system', '{{STORE_ID}}'),
  ('6301212b-22c0-40de-8435-6a65560934f1', 'common.your_wishlist_is_empty', 'en', 'Your wishlist is empty.', 'common', '2025-11-07T18:34:17.198Z', '2025-11-07T18:34:17.198Z', 'system', '{{STORE_ID}}'),
  ('166cdca8-8ca3-4224-ad53-3ae5b9055ca4', 'common.email_address', 'en', 'Email Address', 'common', '2025-11-07T18:34:17.198Z', '2025-11-07T18:34:17.198Z', 'system', '{{STORE_ID}}'),
  ('695b0c4c-4bf4-4ea4-b446-95f8753f2a81', 'common.enter_your_email', 'en', 'Enter your email', 'common', '2025-11-07T18:34:17.198Z', '2025-11-07T18:34:17.198Z', 'system', '{{STORE_ID}}'),
  ('be5fa057-c356-4734-946a-7fbd0ae1bea2', 'common.enter_your_password', 'en', 'Enter your password', 'common', '2025-11-07T18:34:17.198Z', '2025-11-07T18:34:17.198Z', 'system', '{{STORE_ID}}'),
  ('192dbb86-6c0b-412d-847d-1be9b5fe199e', 'common.failed_apply_coupon', 'en', 'Failed to apply coupon', 'common', '2025-11-07T18:34:17.198Z', '2025-11-07T18:34:17.198Z', 'system', '{{STORE_ID}}'),
  ('7d862253-4733-4009-a2d3-01ba451e223c', 'common.first_name', 'en', 'First Name', 'common', '2025-11-07T18:34:17.198Z', '2025-11-07T18:34:17.198Z', 'system', '{{STORE_ID}}'),
  ('aec86547-a9d5-4153-9c34-85f9b93a82a6', 'common.last_name', 'en', 'Last Name', 'common', '2025-11-07T18:34:17.198Z', '2025-11-07T18:34:17.198Z', 'system', '{{STORE_ID}}'),
  ('20dd5de7-a3c6-4773-8490-c5c92b0a9604', 'common.no_items_yet', 'en', 'No items yet', 'common', '2025-11-07T18:34:17.198Z', '2025-11-07T18:34:17.198Z', 'system', '{{STORE_ID}}'),
  ('fd6f88f4-8c70-497d-bafa-a06e1f9b528b', 'common.password', 'en', 'Password', 'common', '2025-11-07T18:34:17.198Z', '2025-11-07T18:34:17.198Z', 'system', '{{STORE_ID}}'),
  ('04175c37-b71d-4e0d-8206-88f84dee96f6', 'common.remember_me', 'en', 'Remember me', 'common', '2025-11-07T18:34:17.198Z', '2025-11-07T18:34:17.198Z', 'system', '{{STORE_ID}}'),
  ('4d14b2b1-a530-42f6-b321-6b5bbe56e157', 'common.signing_in', 'en', 'Signing in...', 'common', '2025-11-07T18:34:17.198Z', '2025-11-07T18:34:17.198Z', 'system', '{{STORE_ID}}'),
  ('e7adae03-0287-46b3-868d-5e4883bab8c0', 'address.list', 'en', 'Addresses', 'address', '2025-11-07T18:34:17.198Z', '2025-11-07T18:34:17.198Z', 'system', '{{STORE_ID}}'),
  ('60b6afe0-d4f7-465b-99f8-40b2af98b382', 'category.no_products_found', 'en', 'No Products Found', 'category', '2025-11-07T18:34:17.198Z', '2025-11-07T18:34:17.198Z', 'system', '{{STORE_ID}}'),
  ('ea2d1369-f051-4979-99a4-380f2441125e', 'category.no_products_in_category', 'en', 'No products found in the "{category}" category.', 'category', '2025-11-07T18:34:17.198Z', '2025-11-07T18:34:17.198Z', 'system', '{{STORE_ID}}'),
  ('54ad3e72-4cea-458e-b168-adbadae8b422', 'category.no_products_match_filters', 'en', 'No products match your current filters.', 'category', '2025-11-07T18:34:17.198Z', '2025-11-07T18:34:17.198Z', 'system', '{{STORE_ID}}'),
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'category.no_products_match', 'en', 'No products match your filters', 'category', '2025-11-07T18:34:17.198Z', '2025-11-07T18:34:17.198Z', 'system', '{{STORE_ID}}'),
  ('b2c3d4e5-f6a7-8901-bcde-f12345678901', 'category.try_different_filters', 'en', 'Try adjusting your filters or clearing some selections to see more products.', 'category', '2025-11-07T18:34:17.198Z', '2025-11-07T18:34:17.198Z', 'system', '{{STORE_ID}}'),
  ('c2489727-9b25-447c-8d25-92e4ddad1662', 'address.my', 'en', 'My Addresses', 'address', '2025-11-07T18:34:17.198Z', '2025-11-07T18:34:17.198Z', 'system', '{{STORE_ID}}'),
  ('0fe9ed69-c382-4a8f-8599-b60dc7eea9a9', 'address.saved', 'en', 'Saved Addresses', 'address', '2025-11-07T18:34:17.198Z', '2025-11-07T18:34:17.198Z', 'system', '{{STORE_ID}}'),
  ('442de4fa-37f7-404e-9f11-26cca1e90cb6', 'address.delivery_locations', 'en', 'Delivery locations', 'address', '2025-11-07T18:34:17.198Z', '2025-11-07T18:34:17.198Z', 'system', '{{STORE_ID}}'),
  ('eec84e2e-4f37-4c61-b463-73903b676994', 'address.add', 'en', 'Add Address', 'address', '2025-11-07T18:34:17.198Z', '2025-11-07T18:34:17.198Z', 'system', '{{STORE_ID}}'),
  ('cb58104a-33d1-4041-b2fe-da0a853519d8', 'address.edit', 'en', 'Edit Address', 'address', '2025-11-07T18:34:17.198Z', '2025-11-07T18:34:17.198Z', 'system', '{{STORE_ID}}'),
  ('d9c9f576-49ae-4096-9ff4-5b8ba2017401', 'address.add_new', 'en', 'Add New Address', 'address', '2025-11-07T18:34:17.198Z', '2025-11-07T18:34:17.198Z', 'system', '{{STORE_ID}}'),
  ('1315ca8e-67cc-485f-af90-24fce71e06a2', 'address.update', 'en', 'Update Address', 'address', '2025-11-07T18:34:17.198Z', '2025-11-07T18:34:17.198Z', 'system', '{{STORE_ID}}'),
  ('3c727eb9-a1d0-458c-96f3-d14fe0bf8338', 'common.saving', 'en', 'Saving...', 'common', '2025-11-07T18:34:17.198Z', '2025-11-07T18:34:17.198Z', 'system', '{{STORE_ID}}'),
  ('56020422-a209-41f7-8795-967ef8e6b808', 'common.details', 'en', 'Details', 'common', '2025-11-07T18:34:17.198Z', '2025-11-07T18:34:17.198Z', 'system', '{{STORE_ID}}'),
  ('3c36b186-918d-4498-ab4e-70017a43e809', 'common.less', 'en', 'Less', 'common', '2025-11-07T18:34:17.198Z', '2025-11-07T18:34:17.198Z', 'system', '{{STORE_ID}}'),
  ('2c0fbb56-349e-4efe-9771-a4a97f58c4c8', 'common.each', 'en', 'each', 'common', '2025-11-07T18:34:17.198Z', '2025-11-07T18:34:17.198Z', 'system', '{{STORE_ID}}'),
  ('d715f8c8-9da4-4d23-b135-3b25925002c5', 'common.method', 'en', 'Method', 'common', '2025-11-07T18:34:17.198Z', '2025-11-07T18:34:17.198Z', 'system', '{{STORE_ID}}'),
  ('d8582444-af32-4fab-ac02-c855c0f4fcb7', 'common.phone', 'en', 'Phone', 'common', '2025-11-07T18:34:17.198Z', '2025-11-07T18:34:17.198Z', 'system', '{{STORE_ID}}'),
  ('ef83411d-d20f-45e9-b27b-8f03463fc40f', 'common.creating', 'en', 'Creating...', 'common', '2025-11-07T18:34:17.198Z', '2025-11-07T18:34:17.198Z', 'system', '{{STORE_ID}}'),
  ('afd87d87-b96e-443c-9b40-6d2cb2b930fa', 'common.unknown_product', 'en', 'Unknown Product', 'common', '2025-11-07T18:34:17.198Z', '2025-11-07T18:34:17.198Z', 'system', '{{STORE_ID}}'),
  ('6acdcdf4-94e9-4281-916d-ef5c2134b495', 'common.all_time', 'en', 'All time', 'common', '2025-11-07T18:34:17.198Z', '2025-11-07T18:34:17.198Z', 'system', '{{STORE_ID}}'),
  ('893f171b-9193-4c97-b31f-350f409edd75', 'common.status', 'en', 'Status', 'common', '2025-11-07T18:34:17.198Z', '2025-11-07T18:34:17.198Z', 'system', '{{STORE_ID}}'),
  ('299c4eee-e393-4028-b36e-7053ccb56d15', 'common.qty', 'en', 'Qty', 'common', '2025-11-07T18:34:17.198Z', '2025-11-07T18:34:17.198Z', 'system', '{{STORE_ID}}'),
  ('51e787d8-868c-4620-970c-9f525d6a93e2', 'order.your_orders', 'en', 'Orders', 'order', '2025-11-07T18:34:17.198Z', '2025-11-07T18:34:17.198Z', 'system', '{{STORE_ID}}'),
  ('0c34a76a-14a9-4986-98d2-101eebb68cd1', 'common.billing_address', 'en', 'Billing Address', 'common', '2025-11-07T18:34:17.198Z', '2025-11-07T18:34:17.198Z', 'system', '{{STORE_ID}}'),
  ('41530bad-4331-4496-9686-2dd58d895a84', 'common.sku', 'en', 'SKU', 'common', '2025-11-07T18:34:17.198Z', '2025-11-07T18:34:17.198Z', 'system', '{{STORE_ID}}'),
  ('537278e8-db77-44a4-9ba9-3a934f56b776', 'checkout.payment_method', 'en', 'Payment Method', 'common', '2025-11-07T18:34:17.198Z', '2025-11-07T18:34:17.198Z', 'custom', '{{STORE_ID}}'),
  ('d73eee14-5d3a-4f03-aca5-b61e61c06261', 'common.product', 'en', 'Product', 'common', '2025-11-07T18:34:17.198Z', '2025-11-07T18:34:17.198Z', 'system', '{{STORE_ID}}'),
  ('6ccfbe9e-776f-4914-9f0a-b7d98b9f28c6', 'common.options', 'en', 'Options', 'common', '2025-11-07T18:34:17.198Z', '2025-11-07T18:34:17.198Z', 'system', '{{STORE_ID}}'),
  ('8e8e6a1b-8c66-48cf-9a33-2096afb71286', 'account.my_account', 'en', 'My Account', 'account', '2025-11-07T18:34:17.198Z', '2025-11-07T18:34:17.198Z', 'system', '{{STORE_ID}}'),
  ('92903f0d-0f5b-44f6-9952-b5758cbb9484', 'account.manage', 'en', 'Manage your account, orders, and preferences', 'account', '2025-11-07T18:34:17.198Z', '2025-11-07T18:34:17.198Z', 'system', '{{STORE_ID}}'),
  ('34298d33-2d72-48cb-b62e-669da73250d9', 'account.overview', 'en', 'Overview', 'account', '2025-11-07T18:34:17.198Z', '2025-11-07T18:34:17.198Z', 'system', '{{STORE_ID}}'),
  ('ce708c1c-a222-466c-b6b4-f24afcd9e47f', 'account.sign_out', 'en', 'Sign Out', 'account', '2025-11-07T18:34:17.198Z', '2025-11-07T18:34:17.198Z', 'system', '{{STORE_ID}}'),
  ('5f86c956-59d2-4f7e-8082-b6faf37f090f', 'account.welcome_to_store', 'en', 'Welcome to SprShop', 'account', '2025-11-07T18:34:17.198Z', '2025-11-07T18:34:17.198Z', 'system', '{{STORE_ID}}'),
  ('833adb10-4d32-42fa-91e1-06c956258801', 'account.discover_products', 'en', 'Discover our premium products and services', 'account', '2025-11-07T18:34:17.198Z', '2025-11-07T18:34:17.198Z', 'system', '{{STORE_ID}}'),
  ('f8f2acda-0d96-406b-8d7a-5fb7c145f97b', 'account.welcome_guest', 'en', 'Welcome, Guest!', 'account', '2025-11-07T18:34:17.198Z', '2025-11-07T18:34:17.198Z', 'system', '{{STORE_ID}}'),
  ('1467bef4-841c-4aa3-b5a3-acaae2650112', 'account.create_new', 'en', 'Create New Account', 'account', '2025-11-07T18:34:17.198Z', '2025-11-07T18:34:17.198Z', 'system', '{{STORE_ID}}'),
  ('24669258-26e5-4ddc-bb8c-6d11fcbd5a49', 'order.total_orders', 'en', 'Total Orders', 'order', '2025-11-07T18:34:17.198Z', '2025-11-07T18:34:17.198Z', 'system', '{{STORE_ID}}'),
  ('b0326300-5a7e-4168-ae57-fe056eb00291', 'order.no_orders_yet', 'en', 'No orders yet', 'order', '2025-11-07T18:34:17.198Z', '2025-11-07T18:34:17.198Z', 'system', '{{STORE_ID}}'),
  ('3edb7767-620b-45cd-b0cd-4041963ce3e7', 'order.order_history', 'en', 'Your order history will appear here once you make a purchase.', 'order', '2025-11-07T18:34:17.198Z', '2025-11-07T18:34:17.198Z', 'system', '{{STORE_ID}}'),
  ('3a7843bf-5c04-4568-bc18-b1a4107a06cb', 'order.number', 'en', 'Order', 'order', '2025-11-07T18:34:17.198Z', '2025-11-07T18:34:17.198Z', 'system', '{{STORE_ID}}'),
  ('7843d7b9-20cb-44e2-9d3f-d049ca482fbc', 'stock.in_stock_label', 'en', 'In Stock {({quantity} {item} available)}', 'stock', '2025-11-07T18:34:17.198Z', '2025-11-07T18:34:17.198Z', 'system', '{{STORE_ID}}'),
  ('fe732240-9d4c-41b7-b3c1-fd939e891fce', 'common.country', 'en', 'Select Country', 'common', '2025-11-07T18:34:17.198Z', '2025-11-12T22:28:53.341Z', 'system', '{{STORE_ID}}'),
  ('c8e8e88c-1931-4cc0-9256-1be45ff30b9a', 'success.order_placed', 'en', 'Your order has been successfully placed', 'order_success', '2025-11-07T18:34:17.198Z', '2025-11-07T18:34:17.198Z', 'system', '{{STORE_ID}}'),
  ('658f7a13-afed-4fc0-a83c-6846b071b024', 'success.confirmation_sent', 'en', 'A confirmation email has been sent to', 'order_success', '2025-11-07T18:34:17.198Z', '2025-11-07T18:34:17.198Z', 'system', '{{STORE_ID}}'),
  ('56a0de09-6fa6-4436-81df-844a46c894a9', 'success.download_invoice', 'en', 'Download Invoice', 'order_success', '2025-11-07T18:34:17.198Z', '2025-11-07T18:34:17.198Z', 'system', '{{STORE_ID}}'),
  ('6e5c8ded-f671-47f5-b337-5af8fb234326', 'success.create_description', 'en', 'Create an account using your email', 'order_success', '2025-11-07T18:34:17.198Z', '2025-11-07T18:34:17.198Z', 'system', '{{STORE_ID}}'),
  ('7e5c8ded-f671-47f5-b337-5af8fb234326', 'success.create_account', 'en', 'Create Account', 'order_success', '2025-11-07T18:34:17.198Z', '2025-11-07T18:34:17.198Z', 'system', '{{STORE_ID}}'),
  ('8e5c8ded-f671-47f5-b337-5af8fb234326', 'success.existing_account', 'en', 'Existing Account', 'order_success', '2025-11-07T18:34:17.198Z', '2025-11-07T18:34:17.198Z', 'system', '{{STORE_ID}}'),
  ('9e5c8ded-f671-47f5-b337-5af8fb234326', 'success.account_exists', 'en', 'An account exists for', 'order_success', '2025-11-07T18:34:17.198Z', '2025-11-07T18:34:17.198Z', 'system', '{{STORE_ID}}'),
  ('1e5c8ded-f671-47f5-b337-5af8fb234326', 'success.login_prompt', 'en', 'Login to view your order history and track this order.', 'order_success', '2025-11-07T18:34:17.198Z', '2025-11-07T18:34:17.198Z', 'system', '{{STORE_ID}}'),
  ('2e5c8ded-f671-47f5-b337-5af8fb234326', 'success.track_orders', 'en', 'to track your orders', 'order_success', '2025-11-07T18:34:17.198Z', '2025-11-07T18:34:17.198Z', 'system', '{{STORE_ID}}'),
  ('9e004179-b010-4112-aa59-a28555176258', 'success.account_created', 'en', 'Your Account is Now Created!', 'order_success', '2025-11-07T18:34:17.198Z', '2025-11-07T18:34:17.198Z', 'system', '{{STORE_ID}}'),
  ('52b4d7cf-b842-4c77-88b6-c5d92cf7df7d', 'success.welcome_message', 'en', 'Welcome! Your account has been successfully created with email:', 'order_success', '2025-11-07T18:34:17.198Z', '2025-11-07T18:34:17.198Z', 'system', '{{STORE_ID}}'),
  ('96498520-7f4c-43e7-bcf3-2f0f9c30b84f', 'success.welcome_email_sent', 'en', 'A welcome email has been sent to your inbox', 'order_success', '2025-11-07T18:34:17.198Z', '2025-11-07T18:34:17.198Z', 'system', '{{STORE_ID}}'),
  ('1a1744b1-53dc-4f80-9b35-d618b6701fcc', 'success.addresses_saved', 'en', 'Your shipping and billing addresses have been saved', 'order_success', '2025-11-07T18:34:17.198Z', '2025-11-07T18:34:17.198Z', 'system', '{{STORE_ID}}'),
  ('6b22f6fb-9f3c-4163-ab88-c49563c8472f', 'success.track_profile', 'en', 'You can now track your orders and manage your profile', 'order_success', '2025-11-07T18:34:17.198Z', '2025-11-07T18:34:17.198Z', 'system', '{{STORE_ID}}'),
  ('1f179af5-dcfc-4b30-a22f-b3fa3d5edc1e', 'success.view_orders', 'en', 'View My Orders', 'order_success', '2025-11-07T18:34:17.198Z', '2025-11-07T18:34:17.198Z', 'system', '{{STORE_ID}}'),
  ('2f179af5-dcfc-4b30-a22f-b3fa3d5edc1e', 'success.payment_pending_title', 'en', 'Payment pending', 'order_success', '2025-11-07T18:34:17.198Z', '2025-11-07T18:34:17.198Z', 'system', '{{STORE_ID}}'),
  ('3f179af5-dcfc-4b30-a22f-b3fa3d5edc1e', 'success.payment_pending_message', 'en', 'Your order has been placed successfully. Payment will be collected upon delivery.', 'order_success', '2025-11-07T18:34:17.198Z', '2025-11-07T18:34:17.198Z', 'system', '{{STORE_ID}}'),
  ('1abb9f06-a9ff-451d-bfac-e31706f847eb', 'common.item', 'en', 'item', 'common', '2025-11-07T18:34:17.198Z', '2025-11-07T18:34:17.198Z', 'system', '{{STORE_ID}}'),
  ('cb4ac080-d3c5-416c-8770-d7e10f98d082', 'common.items', 'en', 'items', 'common', '2025-11-07T18:34:17.198Z', '2025-11-07T18:34:17.198Z', 'system', '{{STORE_ID}}'),
  ('989059e2-a388-4d5c-a796-e2a01832ce6d', 'common.unit', 'en', 'unit', 'common', '2025-11-07T18:34:17.198Z', '2025-11-07T18:34:17.198Z', 'system', '{{STORE_ID}}'),
  ('f19d8f35-43f6-41bf-a318-546ae6ebebf1', 'common.units', 'en', 'units', 'common', '2025-11-07T18:34:17.198Z', '2025-11-07T18:34:17.198Z', 'system', '{{STORE_ID}}'),
  ('0623841b-ec8b-428b-ba3d-f66588252e3b', 'common.piece', 'en', 'piece', 'common', '2025-11-07T18:34:17.198Z', '2025-11-07T18:34:17.198Z', 'system', '{{STORE_ID}}'),
  ('86329823-5043-4d61-9cd1-7370891e0dc4', 'common.pieces', 'en', 'pieces', 'common', '2025-11-07T18:34:17.198Z', '2025-11-07T18:34:17.198Z', 'system', '{{STORE_ID}}'),
  ('0dcb332b-7444-41f1-a80d-8b5d98cde4eb', 'common.payment_status', 'en', 'Payment status', 'common', '2025-11-07T18:34:17.198Z', '2025-11-07T18:34:17.198Z', 'custom', '{{STORE_ID}}'),
  ('dc8fc6fe-3a42-4f2a-9884-bbb7c3b416a7', 'common.no_country_found', 'en', 'No country found.', 'common', '2025-11-07T18:34:17.198Z', '2025-11-07T18:34:17.198Z', 'system', '{{STORE_ID}}'),
  ('5be9a089-569f-4fea-bb8d-ad8ae5a2b686', 'common.view_all_results_for', 'en', 'View all results for', 'common', '2025-11-07T18:34:17.198Z', '2025-11-07T18:34:17.198Z', 'system', '{{STORE_ID}}'),
  ('8c7658e1-28c7-4ca8-aa22-6d9bce943e10', 'common.search_results_for', 'en', 'Search Results for', 'common', '2025-11-07T18:34:17.198Z', '2025-11-07T18:34:17.198Z', 'system', '{{STORE_ID}}'),
  ('8b99a508-735f-4c53-bd8b-18da69c450f5', 'common.no_products_found_for', 'en', 'No products found for', 'common', '2025-11-07T18:34:17.198Z', '2025-11-07T18:34:17.198Z', 'system', '{{STORE_ID}}'),
  ('ceca15f4-87ad-414b-9087-23c1a1abaa02', 'navigation.dashboard', 'en', 'Dashboard', 'navigation', '2025-11-07T18:34:17.198Z', '2025-11-07T18:34:17.198Z', 'system', '{{STORE_ID}}'),
  ('81293cb6-cdc2-4599-a5b0-a16190dbeee0', 'navigation.products', 'en', 'Products', 'navigation', '2025-11-07T18:34:17.198Z', '2025-11-07T18:34:17.198Z', 'system', '{{STORE_ID}}'),
  ('5d9d2de9-125f-4b0e-8ea4-815ad7ba8d83', 'navigation.categories', 'en', 'Categories', 'navigation', '2025-11-07T18:34:17.198Z', '2025-11-07T18:34:17.198Z', 'system', '{{STORE_ID}}'),
  ('e2442618-b5da-468f-bdcb-158c951f0534', 'navigation.customers', 'en', 'Customers', 'navigation', '2025-11-07T18:34:17.198Z', '2025-11-07T18:34:17.198Z', 'system', '{{STORE_ID}}'),
  ('2e9796e7-dcf9-4ce4-9552-8e37a83b6012', 'navigation.settings', 'en', 'Settings', 'navigation', '2025-11-07T18:34:17.198Z', '2025-11-07T18:34:17.198Z', 'system', '{{STORE_ID}}'),
  ('25bea726-37d4-4e4b-b9e8-e63395c68811', 'common.login', 'en', 'Login', 'navigation', '2025-11-07T18:34:17.198Z', '2025-11-07T18:34:17.198Z', 'system', '{{STORE_ID}}'),
  ('4e1c29bf-965d-4b98-b2de-8d31c3ca10ff', 'checkout.shipping_fee', 'en', 'Shipping Fee', 'checkout', '2025-11-07T18:34:17.198Z', '2025-11-07T18:34:17.198Z', 'system', '{{STORE_ID}}'),
  ('b234b7df-092b-4a78-b8ce-6cbe3709169e', 'checkout.proceed_to_checkout', 'en', 'Proceed to Checkout', 'checkout', '2025-11-07T18:34:17.198Z', '2025-11-07T18:34:17.198Z', 'system', '{{STORE_ID}}'),
  ('4007d86a-f667-42a3-9046-97fdaef89d21', 'account.address', 'en', 'Address', 'account', '2025-11-07T18:34:17.198Z', '2025-11-07T18:34:17.198Z', 'system', '{{STORE_ID}}'),
  ('ff35696b-6755-4fc0-be27-361357170c3c', 'account.city', 'en', 'City', 'account', '2025-11-07T18:34:17.198Z', '2025-11-07T18:34:17.198Z', 'system', '{{STORE_ID}}'),
  ('e7c7cb8c-0120-4dfd-9adc-b45e0f33ca35', 'account.register', 'en', 'Register', 'account', '2025-11-07T18:34:17.198Z', '2025-11-07T18:34:17.198Z', 'system', '{{STORE_ID}}'),
  ('7c4297e0-7722-4160-a8ce-9042a30529bf', 'account.sign_up', 'en', 'Sign Up', 'account', '2025-11-07T18:34:17.198Z', '2025-11-07T18:34:17.198Z', 'system', '{{STORE_ID}}'),
  ('8d887ad9-188f-4595-a529-3939d6d9027a', 'account.reset_password', 'en', 'Reset Password', 'account', '2025-11-07T18:34:17.198Z', '2025-11-07T18:34:17.198Z', 'system', '{{STORE_ID}}'),
  ('5db31261-f1b1-4f64-9222-4d786491ae4e', 'account.my_orders', 'en', 'My Orders', 'account', '2025-11-07T18:34:17.198Z', '2025-11-07T18:34:17.198Z', 'system', '{{STORE_ID}}'),
  ('0bfc650a-bef5-4daf-adc8-eeb89788d64a', 'account.order_history', 'en', 'Order History', 'account', '2025-11-07T18:34:17.198Z', '2025-11-07T18:34:17.198Z', 'system', '{{STORE_ID}}'),
  ('8629a65e-53ab-4576-bc8c-47529951f0db', 'message.success', 'en', 'Success!', 'common', '2025-11-07T18:34:17.198Z', '2025-11-07T18:34:17.198Z', 'system', '{{STORE_ID}}'),
  ('20789e57-aece-4d67-984c-635b253698cc', 'message.error', 'en', 'Error!', 'common', '2025-11-07T18:34:17.198Z', '2025-11-07T18:34:17.198Z', 'system', '{{STORE_ID}}'),
  ('9d30d9b4-c025-4d74-a162-be7be3144fbc', 'message.info', 'en', 'Info', 'common', '2025-11-07T18:34:17.198Z', '2025-11-07T18:34:17.198Z', 'system', '{{STORE_ID}}'),
  ('8c67ef12-6e4a-45ed-a9ea-1174144bebf2', 'message.saved', 'en', 'Saved successfully', 'common', '2025-11-07T18:34:17.198Z', '2025-11-07T18:34:17.198Z', 'system', '{{STORE_ID}}'),
  ('cb5edeee-a328-495a-b31d-12c471d467eb', 'message.deleted', 'en', 'Deleted successfully', 'common', '2025-11-07T18:34:17.198Z', '2025-11-07T18:34:17.198Z', 'system', '{{STORE_ID}}'),
  ('4739c22f-fb70-4ea3-a2a3-33c1d778ba4e', 'message.updated', 'en', 'Updated successfully', 'common', '2025-11-07T18:34:17.198Z', '2025-11-07T18:34:17.198Z', 'system', '{{STORE_ID}}'),
  ('f9972d67-b0d2-4f5d-8d0c-acdb2a500208', 'message.created', 'en', 'Created successfully', 'common', '2025-11-07T18:34:17.198Z', '2025-11-07T18:34:17.198Z', 'system', '{{STORE_ID}}'),
  ('5b885130-3bdd-4a8f-96ae-5a701bfe3ee4', 'message.confirm_delete', 'en', 'Are you sure you want to delete this?', 'common', '2025-11-07T18:34:17.198Z', '2025-11-07T18:34:17.198Z', 'system', '{{STORE_ID}}'),
  ('f0b3204a-6ae5-4157-81c8-10812363a68b', 'message.no_results', 'en', 'No results found', 'common', '2025-11-07T18:34:17.198Z', '2025-11-07T18:34:17.198Z', 'system', '{{STORE_ID}}'),
  ('83d0b547-052f-4b19-8641-7749d16482c7', 'message.required_field', 'en', 'This field is required', 'common', '2025-11-07T18:34:17.198Z', '2025-11-07T18:34:17.198Z', 'system', '{{STORE_ID}}'),
  ('bc0a3d47-75f5-431d-ac0f-20da54573bba', 'admin.update', 'en', 'Update', 'admin', '2025-11-07T18:34:17.198Z', '2025-11-07T18:34:17.198Z', 'system', '{{STORE_ID}}'),
  ('a0a6ce56-910f-4e6b-8b5e-008bdcc79017', 'admin.list', 'en', 'List', 'admin', '2025-11-07T18:34:17.198Z', '2025-11-07T18:34:17.198Z', 'system', '{{STORE_ID}}'),
  ('c01fd81d-5a4b-459b-97e6-7e79cfbe5390', 'admin.bulk_actions', 'en', 'Bulk Actions', 'admin', '2025-11-07T18:34:17.198Z', '2025-11-07T18:34:17.198Z', 'system', '{{STORE_ID}}'),
  ('6f22ef40-4f1d-478f-91a0-6cb8fc1778a9', 'admin.export', 'en', 'Export', 'admin', '2025-11-07T18:34:17.198Z', '2025-11-07T18:34:17.198Z', 'system', '{{STORE_ID}}'),
  ('ab6ff58e-8909-424c-b614-0e3635fbc1d0', 'admin.import', 'en', 'Import', 'admin', '2025-11-07T18:34:17.198Z', '2025-11-07T18:34:17.198Z', 'system', '{{STORE_ID}}'),
  ('ec3126e7-0c5e-401a-a81b-34463f06f098', 'admin.reports', 'en', 'Reports', 'admin', '2025-11-07T18:34:17.198Z', '2025-11-07T18:34:17.198Z', 'system', '{{STORE_ID}}'),
  ('ad6c96d9-38e2-4e66-a597-749b4fccc5e2', 'admin.analytics', 'en', 'Analytics', 'admin', '2025-11-07T18:34:17.198Z', '2025-11-07T18:34:17.198Z', 'system', '{{STORE_ID}}'),
  ('b69bb1a9-c29e-4adf-bd4d-6cda9e14d4b6', 'admin.translations', 'en', 'Translations', 'admin', '2025-11-07T18:34:17.198Z', '2025-11-07T18:34:17.198Z', 'system', '{{STORE_ID}}'),
  ('6a61c3e6-bbbb-42f7-85d9-79b421ebdf1d', 'admin.languages', 'en', 'Languages', 'admin', '2025-11-07T18:34:17.198Z', '2025-11-07T18:34:17.198Z', 'system', '{{STORE_ID}}'),
  ('83995ee0-bfcd-44fd-8233-fae13353c9cc', 'error.blacklist.ip', 'en', 'Your request cannot be processed. Please contact support for assistance.', 'error', '2025-11-07T18:34:17.198Z', '2025-11-07T18:34:17.198Z', 'system', '{{STORE_ID}}'),
  ('7faa03f6-5a18-43be-9a60-2a0250cd85a2', 'error.blacklist.country', 'en', 'Orders from your location cannot be processed at this time. Please contact support for assistance.', 'error', '2025-11-07T18:34:17.198Z', '2025-11-07T18:34:17.198Z', 'system', '{{STORE_ID}}'),
  ('074e7fa7-d66c-44d6-9fdd-a7afe1beed9a', 'checkout.step_3step_1', 'en', 'Information', 'checkout', '2025-11-07T18:34:17.198Z', '2025-11-12T22:28:53.341Z', 'system', '{{STORE_ID}}'),
  ('92597919-c7fd-4907-9bbb-51d9997f373c', 'account.forgot_password', 'en', 'Forgot password?', 'account', '2025-11-07T18:34:17.198Z', '2025-11-12T22:28:53.341Z', 'system', '{{STORE_ID}}'),
  ('42ab27b9-1a5b-419d-94bb-efb5a21d44b5', 'checkout.enter_shipping_address', 'en', 'Enter shipping address', 'checkout', '2025-11-07T18:34:17.198Z', '2025-11-12T22:28:53.341Z', 'system', '{{STORE_ID}}'),
  ('a1b2c3d4-0001-4001-a001-000000000001', 'account.email_not_configured_title', 'en', 'Email Not Configured', 'preview', '2025-12-21T00:00:00.000Z', '2025-12-21T00:00:00.000Z', 'system', '{{STORE_ID}}'),
  ('a1b2c3d4-0001-4001-a001-000000000002', 'account.email_not_configured_description', 'en', 'Please configure an email provider in your store settings to enable customer registration.', 'preview', '2025-12-21T00:00:00.000Z', '2025-12-21T00:00:00.000Z', 'system', '{{STORE_ID}}'),
  ('a1b2c3d4-0001-4001-a001-000000000004', 'account.already_access', 'en', 'Already have access?', 'account', '2025-12-22T00:00:00.000Z', '2025-12-22T00:00:00.000Z', 'system', '{{STORE_ID}}'),
  ('a1b2c3d4-0001-4001-a001-000000000003', 'checkout.order_not_available', 'en', 'Placing orders is not available on a preview store. This is a demonstration only.', 'preview', '2025-12-21T00:00:00.000Z', '2025-12-21T00:00:00.000Z', 'system', '{{STORE_ID}}')
ON CONFLICT DO NOTHING;

-- =============================================
-- SEO Settings
-- =============================================
-- NOTE: Default SEO settings (including robots.txt with dynamic sitemap URL)
-- are now created by TenantProvisioningService.seedDefaultSeoSettings()
-- during the store provisioning process. This ensures the sitemap URL is
-- correctly set based on the store's custom domain or slug.
