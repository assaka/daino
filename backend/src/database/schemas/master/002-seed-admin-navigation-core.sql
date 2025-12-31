-- ============================================
-- ADMIN NAVIGATION CORE SEED DATA
-- Master source of truth for core admin navigation items
-- Order scheme: Top-level = 10, 20, 30... | Children = 1, 2, 3...
-- ============================================

INSERT INTO admin_navigation_core (id, key, label, icon, route, parent_key, default_order_position, default_is_visible, category, required_permission, description, badge_config, type, created_at, updated_at)
VALUES
  -- =============================================
  -- TOP-LEVEL NAVIGATION (default_order_position: 10, 20, 30...)
  -- =============================================
  ('e07959cb-4083-428a-a68f-185f845f9e2d', 'catalog', 'Catalog', 'Package', NULL, NULL, 20, true, NULL, NULL, NULL, NULL, 'standard', NOW(), NOW()),
  ('6c05b36b-b525-4d55-81fe-b8857ed21572', 'sales', 'Sales', 'Receipt', NULL, NULL, 30, true, NULL, NULL, NULL, NULL, 'standard', NOW(), NOW()),
  ('63e01829-d4b6-4e8e-a7f2-9578d4c7f394', 'content', 'Content', 'FileText', NULL, NULL, 40, true, NULL, NULL, NULL, NULL, 'standard', NOW(), NOW()),
  ('a1b2c3d4-e5f6-7890-abcd-000000000002', 'analytics', 'Analytics', 'BarChart3', NULL, NULL, 45, true, NULL, NULL, 'Tracking and insights', NULL, 'standard', NOW(), NOW()),
  ('8ed2a4ed-f089-4d31-907c-4890a0fe3f93', 'marketing', 'Marketing', 'Mail', NULL, NULL, 50, false, NULL, NULL, 'Email campaigns and automations', NULL, 'standard', NOW(), NOW()),
  ('a1b2c3d4-e5f6-7890-abcd-000000000003', 'crm', 'CRM', 'Users', NULL, NULL, 55, false, NULL, NULL, 'Sales pipeline and leads', NULL, 'standard', NOW(), NOW()),
  ('245a141f-f41b-4e1c-9030-639681b0ac7d', 'import_export', 'Import & Export', 'Upload', NULL, NULL, 60, true, NULL, NULL, NULL, NULL, 'standard', NOW(), NOW()),
  ('458e07de-a8b2-401a-91bb-bcb4bab85456', 'seo', 'SEO', 'Search', NULL, NULL, 70, true, NULL, NULL, NULL, NULL, 'standard', NOW(), NOW()),
  ('c8478891-a228-42c7-bf48-df2543ac9536', 'layout', 'Layout', 'Megaphone', NULL, NULL, 80, true, NULL, NULL, NULL, NULL, 'standard', NOW(), NOW()),
  ('ffb70e1a-6d90-46bd-a890-7837404ff1ab', 'store', 'Store', 'Store', NULL, NULL, 90, true, NULL, NULL, NULL, NULL, 'standard', NOW(), NOW()),
  ('a1b2c3d4-e5f6-7890-abcd-000000000001', 'advanced', 'Advanced', 'Settings', NULL, NULL, 100, false, NULL, NULL, 'Advanced settings and tools', NULL, 'standard', NOW(), NOW()),

  -- =============================================
  -- CATALOG CHILDREN (parent: catalog, order: 1, 2, 3...)
  -- =============================================
  ('be829aa4-6a01-4db3-a73d-c7d105f838f1', 'products', 'Products', 'Package', '/admin/products', 'catalog', 1, true, 'catalog', NULL, NULL, NULL, 'standard', NOW(), NOW()),
  ('0e599da5-acb3-42b9-95f3-40bec8114ecf', 'categories', 'Categories', 'Tag', '/admin/categories', 'catalog', 2, true, 'catalog', NULL, NULL, NULL, 'standard', NOW(), NOW()),
  ('29f2a22b-fa56-466b-80fe-5f970db59f39', 'attributes', 'Attributes', 'Box', '/admin/attributes', 'catalog', 3, true, 'catalog', NULL, NULL, NULL, 'standard', NOW(), NOW()),
  ('0668a4f5-529c-4e15-b230-e3ae93f3aeb7', 'custom_option_rules', 'Custom Options', 'Settings', '/admin/custom-option-rules', 'catalog', 4, true, 'catalog', NULL, NULL, NULL, 'standard', NOW(), NOW()),
  ('5025c86d-8955-4c4d-a67a-78212e0e7182', 'product_tabs', 'Product Tabs', 'FileText', '/admin/product-tabs', 'catalog', 5, true, 'catalog', NULL, NULL, NULL, 'standard', NOW(), NOW()),
  ('2036d4dc-cbb7-4587-95bf-5dbfea2741dc', 'product_labels', 'Product Labels', 'Tag', '/admin/product-labels', 'catalog', 6, true, 'catalog', NULL, NULL, NULL, 'standard', NOW(), NOW()),
  ('0a442ac7-a056-4da4-9f40-902c5a41bd00', 'stock_settings', 'Stock Settings', 'Package', '/admin/stock-settings', 'catalog', 7, true, 'catalog', NULL, NULL, NULL, 'standard', NOW(), NOW()),

  -- =============================================
  -- SALES CHILDREN (parent: sales, order: 1, 2, 3...)
  -- =============================================
  ('5bfea719-f62a-40e4-ba87-9259fb295e99', 'sales-settings', 'Settings', 'SettingsIcon', '/admin/sales-settings', 'sales', 1, true, 'main', NULL, NULL, NULL, 'standard', NOW(), NOW()),
  ('34efb882-144a-4177-90a4-0da9312baef7', 'orders', 'Orders', 'Receipt', '/admin/orders', 'sales', 2, true, 'sales', NULL, NULL, NULL, 'standard', NOW(), NOW()),
  ('6d782a02-a782-44dd-9721-552701e55571', 'customers', 'Customers', 'Users', '/admin/customers', 'sales', 3, true, 'sales', NULL, NULL, NULL, 'standard', NOW(), NOW()),
  ('9c18f251-f391-47aa-84ba-8c155f07e808', 'tax', 'Tax', 'DollarSign', '/admin/tax', 'sales', 4, true, 'sales', NULL, NULL, NULL, 'standard', NOW(), NOW()),
  ('e8f92e5e-0e96-4b4d-bf43-25fea085035a', 'blacklist', 'Blacklist', 'Shield', '/admin/blacklist', 'sales', 5, true, 'main', NULL, NULL, NULL, 'standard', NOW(), NOW()),
  ('f00b2a6d-21c6-44bb-bead-2d773a097c42', 'shipping_methods', 'Shipping Methods', 'Truck', '/admin/shipping-methods', 'sales', 6, true, 'sales', NULL, NULL, NULL, 'standard', NOW(), NOW()),
  ('f2237ccf-8449-42f3-ad6e-8ef6773e0010', 'payment_methods', 'Payment Methods', 'CreditCard', '/admin/payment-methods', 'sales', 7, true, 'sales', NULL, NULL, NULL, 'standard', NOW(), NOW()),
  ('ba916985-a696-4fbd-998c-df7cffa7ed28', 'coupons', 'Coupons', 'Ticket', '/admin/coupons', 'sales', 8, true, 'sales', NULL, NULL, NULL, 'standard', NOW(), NOW()),
  ('9e88d83f-3820-47ac-9138-7c7bc381ee41', 'delivery_settings', 'Delivery Settings', 'Calendar', '/admin/delivery-settings', 'sales', 9, true, 'sales', NULL, NULL, NULL, 'standard', NOW(), NOW()),

  -- =============================================
  -- CONTENT CHILDREN (parent: content, order: 1, 2, 3...)
  -- =============================================
  ('9deae6d2-8b79-4961-9aa7-af5c420b530a', 'cms_pages', 'CMS Pages', 'FileText', '/admin/cms-pages', 'content', 1, true, 'content', NULL, NULL, NULL, 'standard', NOW(), NOW()),
  ('19abe7de-a1d1-42ff-9da2-30ffb19c1e6b', 'cms_blocks', 'CMS Blocks', 'Square', '/admin/cms-blocks', 'content', 2, true, 'content', NULL, NULL, NULL, 'standard', NOW(), NOW()),
  ('3d5d200b-a385-4f40-8ab0-6c234295cddc', 'file_library', 'File Library', 'Upload', '/admin/file-library', 'content', 3, true, 'content', NULL, NULL, NULL, 'standard', NOW(), NOW()),
  ('250c4f0b-bcaf-45c6-b865-0967326f623d', 'emails', 'Emails', 'Mail', '/admin/emails', 'content', 4, true, 'content', NULL, NULL, NULL, 'standard', NOW(), NOW()),

  -- =============================================
  -- ANALYTICS CHILDREN (parent: analytics, order: 1, 2, 3...)
  -- =============================================
  ('621a4cd9-84e9-420b-82f8-b3b837b45059', 'analytics_dashboard', 'Dashboard', 'BarChart3', '/admin/analytics', 'analytics', 1, true, 'analytics', NULL, NULL, NULL, 'standard', NOW(), NOW()),
  ('ef7e14a8-7cde-4635-ad0a-9186b32a7361', 'heatmaps', 'Heatmaps', 'Activity', '/admin/heatmaps', 'analytics', 2, true, 'analytics', NULL, NULL, NULL, 'premium', NOW(), NOW()),
  ('6889bdcd-9849-4c7b-b26a-da08e4a9da25', 'ab_testing', 'A/B Testing', 'FlaskConical', '/admin/ab-testing', 'analytics', 3, true, 'analytics', NULL, NULL, NULL, 'standard', NOW(), NOW()),
  ('bd22f10c-8b2e-4948-b306-431f2a97e7fd', 'customer_activity', 'Customer Activity', 'Users', '/admin/customer-activity', 'analytics', 4, true, 'analytics', NULL, NULL, NULL, 'standard', NOW(), NOW()),
  ('8971f94f-c30c-4029-8432-2696176ca16a', 'cookie_consent', 'Cookie Consent', 'Shield', '/admin/cookie-consent', 'analytics', 5, true, 'analytics', NULL, 'GDPR compliance and consent management', NULL, 'standard', NOW(), NOW()),

  -- =============================================
  -- MARKETING CHILDREN (parent: marketing, order: 1, 2, 3...)
  -- =============================================
  ('a1b2c3d4-e5f6-7890-abcd-000000000010', 'campaigns', 'Campaigns', 'Mail', '/admin/marketing/campaigns', 'marketing', 1, false, 'marketing', NULL, 'Email broadcasts and newsletters', NULL, 'standard', NOW(), NOW()),
  ('a1b2c3d4-e5f6-7890-abcd-000000000011', 'automations', 'Automations', 'Workflow', '/admin/marketing/automations', 'marketing', 2, false, 'marketing', NULL, 'Abandoned cart, welcome series, and more', NULL, 'standard', NOW(), NOW()),
  ('a1b2c3d4-e5f6-7890-abcd-000000000012', 'segments', 'Segments', 'UsersRound', '/admin/marketing/segments', 'marketing', 3, false, 'marketing', NULL, 'Audience builder and RFM segments', NULL, 'standard', NOW(), NOW()),
  ('a1b2c3d4-e5f6-7890-abcd-000000000013', 'marketing_integrations', 'Integrations', 'Plug', '/admin/marketing/integrations', 'marketing', 4, false, 'marketing', NULL, 'Klaviyo, Mailchimp, HubSpot', NULL, 'standard', NOW(), NOW()),

  -- =============================================
  -- CRM CHILDREN (parent: crm, order: 1, 2, 3...)
  -- =============================================
  ('a1b2c3d4-e5f6-7890-abcd-000000000020', 'crm_dashboard', 'Dashboard', 'LayoutDashboard', '/admin/crm', 'crm', 1, false, 'crm', NULL, 'CRM overview and metrics', NULL, 'standard', NOW(), NOW()),
  ('a1b2c3d4-e5f6-7890-abcd-000000000021', 'crm_pipelines', 'Pipelines', 'GitBranch', '/admin/crm/pipelines', 'crm', 2, false, 'crm', NULL, 'Sales pipeline management', NULL, 'standard', NOW(), NOW()),
  ('a1b2c3d4-e5f6-7890-abcd-000000000022', 'crm_deals', 'Deals', 'Handshake', '/admin/crm/deals', 'crm', 3, false, 'crm', NULL, 'Opportunities and sales tracking', NULL, 'standard', NOW(), NOW()),
  ('a1b2c3d4-e5f6-7890-abcd-000000000023', 'crm_leads', 'Leads', 'UserPlus', '/admin/crm/leads', 'crm', 4, false, 'crm', NULL, 'Lead management and scoring', NULL, 'standard', NOW(), NOW()),
  ('a1b2c3d4-e5f6-7890-abcd-000000000024', 'crm_activities', 'Activities', 'ListTodo', '/admin/crm/activities', 'crm', 5, false, 'crm', NULL, 'Calls, meetings, and tasks', NULL, 'standard', NOW(), NOW()),

  -- =============================================
  -- IMPORT & EXPORT CHILDREN (parent: import_export, order: 1, 2, 3...)
  -- =============================================
  ('571cf04b-2b04-428a-ad55-9192a56f7976', 'marketplace_hub', 'Marketplace Hub', 'ShoppingCart', '/admin/marketplace-hub', 'import_export', 1, false, 'import_export', NULL, 'Unified marketplace management: Amazon, eBay, and more with AI optimization', '{"text":"New","color":"blue","variant":"default"}'::jsonb, 'new', NOW(), NOW()),
  ('0162fe04-d1b3-4871-a92a-be7d54afd002', 'shopify_integration', 'Shopify', 'ShoppingBag', '/admin/shopify-integration', 'import_export', 2, true, 'import_export', NULL, NULL, NULL, 'standard', NOW(), NOW()),
  ('4a706191-0c65-48c4-8efa-f355454fab8e', 'akeneo_integration', 'Akeneo', 'Database', '/admin/akeneo-integration', 'import_export', 3, true, 'import_export', NULL, NULL, NULL, 'beta', NOW(), NOW()),
  ('5415ee5a-1276-4883-ac01-33d3dfcb1c2b', 'import_export_jobs', 'Jobs & Analytics', 'BarChart3', '/admin/import-export-jobs', 'import_export', 4, true, 'import_export', NULL, 'Monitor import/export jobs and view performance analytics', NULL, 'standard', NOW(), NOW()),

  -- =============================================
  -- SEO CHILDREN (parent: seo, order: 1, 2, 3...)
  -- =============================================
  ('067d4c9b-7823-4f64-be28-8c75450d231e', 'seo_settings', 'Global', 'Search', '/admin/seo-tools/settings', 'seo', 1, true, 'seo', NULL, NULL, NULL, 'standard', NOW(), NOW()),
  ('dd08ce7f-b4ae-40dc-ae0a-e0e8667a9a2e', 'seo_templates', 'SEO Templates', 'FileText', '/admin/seo-tools/templates', 'seo', 2, true, 'seo', NULL, NULL, NULL, 'standard', NOW(), NOW()),
  ('c4c35189-2da3-4062-a490-cab76a4cd967', 'seo_redirects', 'Redirects', 'RefreshCw', '/admin/seo-tools/redirects', 'seo', 3, true, 'seo', NULL, NULL, NULL, 'standard', NOW(), NOW()),
  ('c4c35189-2da3-4062-a490-cab76a4c3234', 'product_feeds', 'Product Feeds', 'Rss', '/admin/seo-tools/product-feeds', 'seo', 4, true, 'seo', NULL, NULL, NULL, 'standard', NOW(), NOW()),
  ('6d54e5c6-d6d8-4ea0-aa72-8eacc29f0f72', 'seo_canonical', 'Canonical URLs', 'Link', '/admin/seo-tools/canonical', 'seo', 5, true, 'seo', NULL, NULL, NULL, 'standard', NOW(), NOW()),
  ('572c97b0-a00e-4a65-8a5d-e87036325e68', 'seo_hreflang', 'Hreflang', 'Globe', '/admin/seo-tools/hreflang', 'seo', 6, true, 'seo', NULL, NULL, NULL, 'standard', NOW(), NOW()),
  ('c498373d-a513-4f78-b732-3c1933d181c9', 'seo_robots', 'Robots.txt', 'Bot', '/admin/seo-tools/robots', 'seo', 7, true, 'seo', NULL, NULL, NULL, 'standard', NOW(), NOW()),
  ('c724b28d-e3bc-48ae-8707-87d585a7fe74', 'seo_social', 'Social Media', 'Share2', '/admin/seo-tools/social', 'seo', 8, true, 'seo', NULL, NULL, NULL, 'standard', NOW(), NOW()),
  ('793535ce-1c1f-4c35-9cb0-24f05a52f047', 'xml_sitemap', 'XML Sitemap', 'FileCode', '/admin/xml-sitemap', 'seo', 9, true, 'seo', NULL, NULL, NULL, 'standard', NOW(), NOW()),
  ('7ecc37c8-13fe-45a2-bded-0172da9184de', 'html_sitemap', 'HTML Sitemap', 'FileText', '/admin/html-sitemap', 'seo', 10, true, 'seo', NULL, NULL, NULL, 'standard', NOW(), NOW()),
  ('86af5d49-7fb1-405e-a371-f627274772b5', 'seo_report', 'SEO Report', 'FileText', '/admin/seo-tools/report', 'seo', 11, true, 'seo', NULL, NULL, NULL, 'standard', NOW(), NOW()),

  -- =============================================
  -- LAYOUT CHILDREN (parent: layout, order: 1, 2, 3...)
  -- =============================================
  ('237cfcb8-0464-44ab-916a-d2425f7bad73', 'theme_layout', 'Theme & Layout', 'Palette', '/admin/theme-layout', 'layout', 1, true, 'store', NULL, NULL, NULL, 'standard', NOW(), NOW()),
  ('90e36469-b9e5-4a2b-8d7d-5fde01f066e9', 'translations', 'Translations', 'Globe', '/admin/translations', 'layout', 2, true, 'store', NULL, NULL, NULL, 'new', NOW(), NOW()),

  -- =============================================
  -- STORE CHILDREN (parent: store, order: 1, 2, 3...)
  -- =============================================
  ('e4de6184-0894-409c-b819-58bd3a0539d5', 'settings', 'General Settings', 'Settings', '/admin/settings', 'store', 1, true, 'store', NULL, NULL, NULL, 'standard', NOW(), NOW()),
  ('18727c04-a31b-4dc4-9b06-9d81a71beeee', 'database_integrations', 'Database', 'Database', '/admin/database-integrations', 'store', 2, true, 'store', NULL, NULL, NULL, 'standard', NOW(), NOW()),
  ('93b2fb65-e369-4631-976a-35a764de7459', 'store_email', 'Email', 'Mail', '/admin/email', 'store', 3, true, 'store', NULL, NULL, NULL, 'standard', NOW(), NOW()),
  ('31085f55-2a25-40ed-83ba-be0c80998b81', 'media_storage', 'Media Storage', 'Image', '/admin/media-storage', 'store', 4, true, 'store', NULL, NULL, NULL, 'standard', NOW(), NOW()),
  ('ada124ce-e1a5-4d93-b071-0514350deda0', 'uptime-report', 'Uptime Report', 'Activity', '/admin/uptime-report', 'store', 5, true, 'store', NULL, 'Track daily charges and uptime for running stores', NULL, 'standard', NOW(), NOW()),
  ('2e6e8b58-03e9-4ad2-9ecc-8051c343a269', 'custom_domains', 'Custom Domains', 'Globe', '/admin/custom-domains', 'store', 6, true, 'store', NULL, NULL, NULL, 'standard', NOW(), NOW()),
  ('d15c2f9e-ce66-42a2-85fa-280f8f170f62', 'cache', 'Cache', 'Database', '/admin/cache', 'store', 7, true, 'store', NULL, NULL, NULL, 'standard', NOW(), NOW()),
  ('b3f52d82-6591-4a20-9ed2-d2172c6fec54', 'background_jobs', 'Background Jobs', 'Activity', '/admin/background-jobs', 'store', 8, true, 'advanced', NULL, 'Monitor all background job processing and queue status', NULL, 'standard', NOW(), NOW())
ON CONFLICT (key) DO UPDATE SET
  label = EXCLUDED.label,
  icon = EXCLUDED.icon,
  route = EXCLUDED.route,
  parent_key = EXCLUDED.parent_key,
  default_order_position = EXCLUDED.default_order_position,
  default_is_visible = EXCLUDED.default_is_visible,
  category = EXCLUDED.category,
  description = EXCLUDED.description,
  badge_config = EXCLUDED.badge_config,
  type = EXCLUDED.type,
  updated_at = NOW();
